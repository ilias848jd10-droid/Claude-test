#!/usr/bin/env node
// Turns public/data/kino/draws/<date>.json (every KINO draw for each day in
// the rolling window) into descriptive statistics: how often each number
// has shown up, which numbers have been "hot"/"cold"/overdue, and the most
// frequent pairs — computed over EVERY draw in the window (not just one per
// day), so with ~17k draws these numbers sit very close to the random
// expectation, which is itself the clearest evidence there's no pattern.
//
// IMPORTANT: KINO draws are independent random events (certified RNG).
// Nothing here predicts future numbers — it's descriptive statistics over
// past draws only, kept front-and-center via the `disclaimer` field so
// nothing downstream (UI, notifications) can drop it by accident.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const KINO_DIR = path.join(ROOT, "public", "data", "kino");
const DRAWS_DIR = path.join(KINO_DIR, "draws");
const HISTORY_FILE = path.join(KINO_DIR, "history.json");
const STATS_FILE = path.join(KINO_DIR, "stats.json");

const MIN_NUM = 1;
const MAX_NUM = 80;
const DRAWN_PER_ROUND = 20;
const TOP_N = 10;

const DISCLAIMER =
  "Το KINO είναι τυχαία κλήρωση (πιστοποιημένη γεννήτρια τυχαίων αριθμών). " +
  "Κάθε κλήρωση είναι ανεξάρτητη από τις προηγούμενες — δεν υπάρχει πραγματικό " +
  "μαθηματικό προβάδισμα από ιστορικά στοιχεία. Οι παρακάτω αριθμοί είναι απλώς " +
  "περιγραφικά στατιστικά, όχι πρόβλεψη.";

function countFrequencies(allDraws) {
  const counts = new Map();
  for (let n = MIN_NUM; n <= MAX_NUM; n++) counts.set(n, 0);
  for (const draw of allDraws) {
    for (const n of draw.numbers) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return counts;
}

function computeOverdue(allDraws) {
  // For each number, how many of the most recent draws (chronological,
  // across the whole window) have passed since it last appeared.
  const lastSeenIndex = new Map();
  allDraws.forEach((draw, idx) => {
    for (const n of draw.numbers) lastSeenIndex.set(n, idx);
  });
  const overdue = [];
  for (let n = MIN_NUM; n <= MAX_NUM; n++) {
    const idx = lastSeenIndex.get(n);
    const gapDraws = idx === undefined ? allDraws.length : allDraws.length - 1 - idx;
    overdue.push({
      number: n,
      gapDraws,
      lastSeenDate: idx === undefined ? null : allDraws[idx].date,
      lastSeenTime: idx === undefined ? null : allDraws[idx].time,
    });
  }
  overdue.sort((a, b) => b.gapDraws - a.gapDraws || a.number - b.number);
  return overdue;
}

function computeTopPairs(allDraws, limit) {
  const pairCounts = new Map();
  for (const draw of allDraws) {
    const nums = draw.numbers;
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const key = `${nums[i]}-${nums[j]}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...pairCounts.entries()]
    .map(([key, count]) => {
      const [a, b] = key.split("-").map(Number);
      return { numbers: [a, b], count };
    })
    .sort((a, b) => b.count - a.count || a.numbers[0] - b.numbers[0])
    .slice(0, limit);
}

function buildMorningSummary({ history, allDraws, hot, cold, overdue, generatedAt }) {
  const last = allDraws[allDraws.length - 1];
  const lines = [];
  lines.push(`KINO — πρωινή αναφορά (${new Date(generatedAt).toLocaleDateString("el-GR")})`);
  lines.push("");
  if (last) {
    lines.push(`Τελευταία κλήρωση (${last.date}, κλήρωση #${last.drawId}, ${last.time}):`);
    lines.push(last.numbers.join(", "));
    lines.push("");
  }
  lines.push(
    `Βάση ανάλυσης: ${allDraws.length} κληρώσεις σε ${history.length} ημέρες (${history[0]?.date} → ${history[history.length - 1]?.date}).`
  );
  lines.push(`Πιο "ζεστοί" αριθμοί: ` + hot.slice(0, 5).map((h) => `${h.number} (${h.count}x)`).join(", "));
  lines.push(`Πιο "κρύοι" αριθμοί: ` + cold.slice(0, 5).map((c) => `${c.number} (${c.count}x)`).join(", "));
  lines.push(
    `Πιο "καθυστερημένοι" (δεν έχουν βγει εδώ και πολλές κληρώσεις): ` +
      overdue.slice(0, 5).map((o) => `${o.number} (${o.gapDraws} κληρώσεις)`).join(", ")
  );
  lines.push("");
  lines.push(DISCLAIMER);
  return lines.join("\n");
}

async function main() {
  await mkdir(DRAWS_DIR, { recursive: true });

  let history = [];
  try {
    history = JSON.parse(await readFile(HISTORY_FILE, "utf-8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  if (history.length === 0) {
    console.warn("[kino] no history yet — run fetch-kino.mjs first.");
    return;
  }

  const availableFiles = new Set((await readdir(DRAWS_DIR).catch(() => [])).map((f) => f.replace(/\.json$/, "")));

  const allDraws = [];
  for (const day of history) {
    if (!availableFiles.has(day.date)) continue;
    const dayDraws = JSON.parse(await readFile(path.join(DRAWS_DIR, `${day.date}.json`), "utf-8"));
    for (const d of dayDraws) allDraws.push({ ...d, date: day.date });
  }
  allDraws.sort((a, b) => a.drawId - b.drawId);

  const counts = countFrequencies(allDraws);
  const frequency = [...counts.entries()]
    .map(([number, count]) => ({ number, count }))
    .sort((a, b) => a.number - b.number);

  const byCountDesc = [...frequency].sort((a, b) => b.count - a.count || a.number - b.number);
  const hot = byCountDesc.slice(0, TOP_N);
  const cold = [...frequency].sort((a, b) => a.count - b.count || a.number - b.number).slice(0, TOP_N);
  const overdue = computeOverdue(allDraws).slice(0, TOP_N);
  const topPairs = computeTopPairs(allDraws, TOP_N);

  const generatedAt = new Date().toISOString();
  const lastDraw = allDraws[allDraws.length - 1] ?? null;
  const stats = {
    generatedAt,
    windowDays: history.length,
    windowStart: history[0]?.date ?? null,
    windowEnd: history[history.length - 1]?.date ?? null,
    totalDraws: allDraws.length,
    totalNumbersDrawn: allDraws.length * DRAWN_PER_ROUND,
    expectedCountPerNumber: (allDraws.length * DRAWN_PER_ROUND) / (MAX_NUM - MIN_NUM + 1),
    frequency,
    hot,
    cold,
    overdue,
    topPairs,
    lastDraw,
    disclaimer: DISCLAIMER,
  };
  stats.morningSummary = buildMorningSummary({ history, allDraws, hot, cold, overdue, generatedAt });

  await writeFile(STATS_FILE, JSON.stringify(stats, null, 2) + "\n");
  console.log(
    `Done. Stats written for ${allDraws.length} draws over ${history.length} days (${stats.windowStart} .. ${stats.windowEnd}).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

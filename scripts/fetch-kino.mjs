#!/usr/bin/env node
// KINO (OPAP) full daily-draws fetcher.
//
// KINO draws every 5 minutes (~288 draws/day). This stores EVERY draw of
// every day, for a rolling ~2-month window:
//   public/data/kino/draws/<date>.json   all draws of that day (chronological)
//   public/data/kino/history.json        one summary row per day (for the
//                                        overview table, so the frontend
//                                        doesn't have to load every day's
//                                        full file just to list the days)
//
// Data source: OPAP's public draws API (no key required), game 1100:
//   .../last-result-and-active                    latest completed + active draw
//   .../{drawId}                                  a single draw
//   .../draw-id/{from}/{to}?page=N&property=...    paginated range (10/page,
//                                                  max span ~1000 ids)

import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const KINO_DIR = path.join(ROOT, "public", "data", "kino");
const DRAWS_DIR = path.join(KINO_DIR, "draws");
const HISTORY_FILE = path.join(KINO_DIR, "history.json");

const GAME_ID = 1100;
const API_BASE = "https://api.opap.gr/draws/v3.0";
const ATHENS_TZ = "Europe/Athens";
const BACKFILL_DAYS = 60; // "last two months" the user asked for
const RETENTION_DAYS = 65; // small buffer so the window never drops below 60
const DRAW_INTERVAL_MIN = 5;
const PAGE_SIZE = 10; // fixed by the API, ignores ?size=
const MAX_RANGE_SPAN = 1000; // API rejects wider from/to spans
const CONCURRENCY = 10;

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; kino-fetcher/1.0)" };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
}

function athensDateStr(ms) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ATHENS_TZ }).format(new Date(ms));
}

function athensTimeStr(ms) {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: ATHENS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

function athensOffsetMinutes(atMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS_TZ,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(atMs));
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+2";
  const match = tzName.match(/GMT([+-]\d+)/);
  return match ? parseInt(match[1], 10) * 60 : 120;
}

function endOfAthensDayUTC(dateStr) {
  const noonUTC = Date.parse(`${dateStr}T12:00:00Z`);
  const offsetMin = athensOffsetMinutes(noonUTC);
  return Date.parse(`${dateStr}T23:59:30Z`) - offsetMin * 60 * 1000;
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function previousDateStr(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// --- OPAP API -----------------------------------------------------------

async function fetchLastResultAndActive() {
  const json = await fetchJson(`${API_BASE}/${GAME_ID}/last-result-and-active`);
  return normalizeDraw(json.last);
}

async function fetchDraw(drawId) {
  try {
    const json = await fetchJson(`${API_BASE}/${GAME_ID}/${drawId}`);
    return normalizeDraw(json);
  } catch (err) {
    if (String(err.message).includes("HTTP 404")) return null;
    throw err;
  }
}

function normalizeDraw(json) {
  if (!json || json.status !== "results" || !json.winningNumbers?.list) return null;
  return {
    drawId: json.drawId,
    time: json.drawTime, // epoch ms
    numbers: [...json.winningNumbers.list].sort((a, b) => a - b),
    bonus: json.winningNumbers.bonus?.[0] ?? null,
  };
}

function toStoredDraw(draw) {
  return {
    drawId: draw.drawId,
    time: athensTimeStr(draw.time),
    numbers: draw.numbers,
    bonus: draw.bonus,
  };
}

// Find the last completed draw whose Athens-local date is `dateStr`,
// starting the search near `anchor` (a draw known to be close in time).
async function locateDayClose(dateStr, anchor) {
  const targetMs = endOfAthensDayUTC(dateStr);
  const deltaMinutes = (anchor.time - targetMs) / 60000;
  let id = anchor.drawId - Math.round(deltaMinutes / DRAW_INTERVAL_MIN);

  let draw = await fetchDraw(id);
  let guard = 0;
  while (guard++ < 60) {
    if (!draw) {
      id -= 1;
      draw = await fetchDraw(id);
      continue;
    }
    const d = athensDateStr(draw.time);
    if (d === dateStr) {
      const next = await fetchDraw(id + 1);
      if (!next || athensDateStr(next.time) !== dateStr) {
        return draw;
      }
      id += 1;
      draw = next;
      continue;
    }
    if (d < dateStr) {
      id += 1;
      draw = await fetchDraw(id);
    } else {
      id -= 1;
      draw = await fetchDraw(id);
    }
  }
  return null;
}

// --- Bulk range fetch (concurrent, paginated) ----------------------------

async function pool(tasks, concurrency) {
  const results = new Array(tasks.length);
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

async function fetchPage(from, to, page) {
  const url = `${API_BASE}/${GAME_ID}/draw-id/${from}/${to}?property=drawId&property=winningNumbers&property=drawTime&page=${page}`;
  const json = await fetchJson(url);
  return json.content ?? [];
}

// Fetch every draw with drawId in [fromId, toId], inclusive, respecting the
// API's max range span by splitting into windows, and paginating (10/page)
// within each window with bounded concurrency.
async function fetchDrawRange(fromId, toId) {
  const windows = [];
  for (let s = fromId; s <= toId; s += MAX_RANGE_SPAN + 1) {
    windows.push([s, Math.min(s + MAX_RANGE_SPAN, toId)]);
  }
  const tasks = [];
  for (const [wFrom, wTo] of windows) {
    const span = wTo - wFrom + 1;
    const pages = Math.ceil(span / PAGE_SIZE);
    for (let p = 0; p < pages; p++) tasks.push(() => fetchPage(wFrom, wTo, p));
  }
  const pageResults = await pool(tasks, CONCURRENCY);
  const draws = pageResults
    .flat()
    .filter((d) => d.status === "results" || d.winningNumbers) // defensive
    .map((d) => ({
      drawId: d.drawId,
      time: d.drawTime,
      numbers: [...(d.winningNumbers?.list ?? [])].sort((a, b) => a - b),
      bonus: d.winningNumbers?.bonus?.[0] ?? null,
    }))
    .filter((d) => d.numbers.length === 20)
    .sort((a, b) => a.drawId - b.drawId);
  return draws;
}

// --- Storage --------------------------------------------------------------

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function main() {
  await mkdir(DRAWS_DIR, { recursive: true });

  const latest = await fetchLastResultAndActive();
  if (!latest) throw new Error("Could not fetch latest KINO result");
  console.log(`[kino] latest completed draw: #${latest.drawId} @ ${new Date(latest.time).toISOString()}`);

  const today = athensDateStr(Date.now());
  const existingDayFiles = new Set(
    (await readdir(DRAWS_DIR).catch(() => [])).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
  );

  // Walk backward from "yesterday" (definitely closed) to find each day's
  // closing draw. We need BACKFILL_DAYS+1 closes so that day N's start
  // boundary (= day N-1's close + 1) is known for the oldest requested day.
  const dayCloses = new Map(); // date -> draw
  let anchor = latest;
  for (let i = 1; i <= BACKFILL_DAYS + 1; i++) {
    const dateStr = isoDaysAgo(i);
    const found = await locateDayClose(dateStr, anchor);
    if (found) {
      dayCloses.set(dateStr, found);
      anchor = found;
    } else {
      console.warn(`[kino] could not locate a closing draw for ${dateStr}`);
    }
  }

  const wantedDates = Array.from({ length: BACKFILL_DAYS }, (_, i) => isoDaysAgo(i + 1)).sort();

  const summaries = [];
  for (const dateStr of wantedDates) {
    const close = dayCloses.get(dateStr);
    if (!close) continue;

    if (!existingDayFiles.has(dateStr)) {
      const prevClose = dayCloses.get(previousDateStr(dateStr));
      const startId = prevClose ? prevClose.drawId + 1 : close.drawId - 287; // fallback estimate

      const draws = await fetchDrawRange(startId, close.drawId);
      const filePath = path.join(DRAWS_DIR, `${dateStr}.json`);
      await writeFile(filePath, JSON.stringify(draws.map(toStoredDraw), null, 2) + "\n");
      console.log(`[kino] ${dateStr}: fetched ${draws.length} draws (#${startId}..#${close.drawId})`);
    } else {
      console.log(`[kino] ${dateStr}: already stored, skipping`);
    }

    const dayDraws = await readJsonIfExists(path.join(DRAWS_DIR, `${dateStr}.json`), []);
    summaries.push({
      date: dateStr,
      drawCount: dayDraws.length,
      firstDrawId: dayDraws[0]?.drawId ?? null,
      lastDrawId: dayDraws[dayDraws.length - 1]?.drawId ?? null,
      closingDraw: dayDraws[dayDraws.length - 1] ?? null,
    });
  }

  // Prune day files + summaries outside the retention window.
  const cutoff = isoDaysAgo(RETENTION_DAYS);
  const keepDates = new Set(summaries.map((s) => s.date));
  for (const dateStr of existingDayFiles) {
    if (dateStr < cutoff || (!keepDates.has(dateStr) && dateStr !== today)) {
      await unlink(path.join(DRAWS_DIR, `${dateStr}.json`)).catch(() => {});
    }
  }

  summaries.sort((a, b) => (a.date < b.date ? -1 : 1));
  await writeFile(HISTORY_FILE, JSON.stringify(summaries, null, 2) + "\n");

  const totalDraws = summaries.reduce((sum, s) => sum + s.drawCount, 0);
  console.log(
    `Done. ${summaries.length} days stored, ${totalDraws} total draws (${summaries[0]?.date} .. ${summaries[summaries.length - 1]?.date}).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

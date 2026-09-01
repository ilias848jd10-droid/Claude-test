#!/usr/bin/env node
// KINO (OPAP) daily-close fetcher.
//
// KINO draws every 5 minutes, so this does NOT record every draw — it
// records one "closing" draw per calendar day (the last completed draw of
// that day, Europe/Athens time), the same way the stocks/crypto fetcher
// records one daily closing price. That keeps the dataset small (~60
// points instead of ~17,000) while still giving a real daily data point.
//
// Data source: OPAP's public draws API (no key required):
//   https://api.opap.gr/draws/v3.0/1100/last-result-and-active   (latest)
//   https://api.opap.gr/draws/v3.0/1100/{drawId}                 (single draw)
//
// Output: public/data/kino/history.json — append-only per day (upserted by
// date, so re-running today overwrites today's point instead of
// duplicating it). Entries older than RETENTION_DAYS are pruned.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const KINO_DIR = path.join(ROOT, "public", "data", "kino");
const HISTORY_FILE = path.join(KINO_DIR, "history.json");

const GAME_ID = 1100;
const API_BASE = "https://api.opap.gr/draws/v3.0";
const ATHENS_TZ = "Europe/Athens";
const BACKFILL_DAYS = 60; // "last two months" the user asked for
const RETENTION_DAYS = 65; // small buffer so the window never drops below 60
const DRAW_INTERVAL_MIN = 5;

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; kino-fetcher/1.0)" };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const wait = 1500 * (attempt + 1);
      await sleep(wait);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
}

function athensDateStr(ms) {
  // en-CA formats as YYYY-MM-DD
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
  // 23:59:30 local, treated as UTC clock time, minus the local offset.
  return Date.parse(`${dateStr}T23:59:30Z`) - offsetMin * 60 * 1000;
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
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

function toHistoryPoint(draw) {
  return {
    date: athensDateStr(draw.time),
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
      // No results at this id yet (e.g. future/active draw) — step back.
      id -= 1;
      draw = await fetchDraw(id);
      continue;
    }
    const d = athensDateStr(draw.time);
    if (d === dateStr) {
      const next = await fetchDraw(id + 1);
      if (!next || athensDateStr(next.time) !== dateStr) {
        return draw; // this is the last draw of the day
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

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

function upsertByDate(existing, point) {
  const byDate = new Map(existing.map((p) => [p.date, p]));
  byDate.set(point.date, point);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

function pruneOld(points) {
  const cutoff = isoDaysAgo(RETENTION_DAYS);
  return points.filter((p) => p.date >= cutoff);
}

async function main() {
  await mkdir(KINO_DIR, { recursive: true });
  let history = await readJsonIfExists(HISTORY_FILE, []);

  const latest = await fetchLastResultAndActive();
  if (!latest) throw new Error("Could not fetch latest KINO result");
  console.log(`[kino] latest completed draw: #${latest.drawId} @ ${new Date(latest.time).toISOString()}`);

  const existingDates = new Set(history.map((p) => p.date));
  const today = athensDateStr(Date.now());

  // Figure out which of the last BACKFILL_DAYS days we still need.
  const wanted = [];
  for (let i = 0; i < BACKFILL_DAYS; i++) {
    const dateStr = isoDaysAgo(i);
    if (dateStr === today) continue; // today isn't "closed" yet
    if (!existingDates.has(dateStr)) wanted.push(dateStr);
  }

  let anchor = latest;
  // Walk backward from the most recent day so each day's search starts
  // from a nearby, already-found anchor (keeps request counts low).
  const sortedWanted = wanted.sort().reverse();
  for (const dateStr of sortedWanted) {
    const found = await locateDayClose(dateStr, anchor);
    if (found) {
      history = upsertByDate(history, toHistoryPoint(found));
      anchor = found;
      console.log(`[kino] ${dateStr} -> draw #${found.drawId} (${athensTimeStr(found.time)})`);
    } else {
      console.warn(`[kino] could not locate a closing draw for ${dateStr}`);
    }
    await sleep(120); // be polite to the free public API
  }

  // Also make sure "yesterday" (definitely closed) is captured/refreshed,
  // and, if the very latest draw already belongs to a new day, that's fine
  // — it'll be picked up as "today" on a future run once the day closes.
  const yesterday = isoDaysAgo(1);
  if (!history.some((p) => p.date === yesterday)) {
    const found = await locateDayClose(yesterday, latest);
    if (found) history = upsertByDate(history, toHistoryPoint(found));
  }

  history = pruneOld(history);
  await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2) + "\n");
  console.log(`Done. ${history.length} daily KINO closes stored (${history[0]?.date} .. ${history[history.length - 1]?.date}).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

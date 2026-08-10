#!/usr/bin/env node
// Nightly stats fetcher: pulls latest + historical prices for the stocks and
// crypto listed in data/symbols.json using free, no-API-key sources
// (Yahoo Finance chart API for stocks, CoinGecko for crypto), then writes:
//   - data/latest.json            snapshot of the latest value for every asset
//   - data/history/<id>.json      append-only daily time series per asset
//
// Safe to run repeatedly: history points are upserted by date, so re-running
// on the same day overwrites today's point instead of duplicating it.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "public", "data");
const HISTORY_DIR = path.join(DATA_DIR, "history");

const YAHOO_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; stats-fetcher/1.0)" };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchJson(url, options, retries = 4) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < retries) {
      const wait = 5000 * (attempt + 1);
      console.warn(`  rate limited, retrying in ${wait}ms: ${url}`);
      await sleep(wait);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
}

async function readJsonIfExists(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

function upsertHistory(existingPoints, newPoints) {
  const byDate = new Map(existingPoints.map((p) => [p.date, p]));
  for (const p of newPoints) byDate.set(p.date, { ...byDate.get(p.date), ...p });
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

async function writeHistory(id, newPoints) {
  const filePath = path.join(HISTORY_DIR, `${id}.json`);
  const existing = await readJsonIfExists(filePath, []);
  const merged = upsertHistory(existing, newPoints);
  await writeFile(filePath, JSON.stringify(merged, null, 2) + "\n");
  return merged;
}

// --- Stocks (Yahoo Finance chart API) -------------------------------------
// One request returns both ~6 months of daily closes and the latest quote,
// so seeding and nightly updates share the same code path.
async function fetchStock(entry) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    entry.symbol
  )}?range=6mo&interval=1d`;
  const json = await fetchJson(url, { headers: YAHOO_HEADERS });
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${entry.symbol}`);

  const { meta, timestamp = [], indicators } = result;
  const closes = indicators?.quote?.[0]?.close ?? [];
  const points = timestamp
    .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), price: closes[i] }))
    .filter((p) => typeof p.price === "number");

  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose;
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;

  // Ensure today's point reflects the live quote even if the exchange is
  // mid-session and the daily candle hasn't closed yet.
  const merged = upsertHistory(points, [{ date: todayISO(), price }]);

  return {
    latest: {
      id: entry.id,
      symbol: entry.symbol,
      name: entry.name,
      type: "stock",
      category: entry.category,
      price,
      changePct24h: changePct,
      currency: meta.currency ?? "USD",
    },
    history: merged,
  };
}

// --- Crypto (CoinGecko) -----------------------------------------------------
async function fetchCryptoLatest(entries) {
  const ids = entries.map((e) => e.id).join(",");
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
    ids
  )}&price_change_percentage=24h`;
  const rows = await fetchJson(url);
  const byId = new Map(rows.map((r) => [r.id, r]));

  return entries.map((entry) => {
    const row = byId.get(entry.id);
    if (!row) return null;
    return {
      id: entry.id,
      symbol: entry.symbol,
      name: entry.name,
      type: "crypto",
      category: entry.category,
      price: row.current_price,
      changePct24h: row.price_change_percentage_24h_in_currency ?? row.price_change_percentage_24h,
      currency: "USD",
    };
  });
}

async function fetchCryptoHistory(entry, days = 90) {
  const url = `https://api.coingecko.com/api/v3/coins/${entry.id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const json = await fetchJson(url);
  const prices = json.prices ?? []; // [ [ms, price], ... ]
  return prices.map(([ms, price]) => ({ date: new Date(ms).toISOString().slice(0, 10), price }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await mkdir(HISTORY_DIR, { recursive: true });
  const symbols = JSON.parse(await readFile(path.join(DATA_DIR, "symbols.json"), "utf-8"));

  const latestAssets = [];
  const errors = [];

  // Stocks: one Yahoo call per symbol gives latest + history together.
  for (const entry of symbols.stocks) {
    try {
      const { latest, history } = await fetchStock(entry);
      await writeHistory(entry.id, history);
      latestAssets.push(latest);
      console.log(`[stock] ${entry.symbol} -> $${latest.price}`);
    } catch (err) {
      console.error(`[stock] ${entry.symbol} failed: ${err.message}`);
      errors.push({ id: entry.id, error: err.message });
    }
    await sleep(250); // be polite to the free endpoint
  }

  // Crypto: one batched call for all latest prices...
  try {
    const latest = await fetchCryptoLatest(symbols.crypto);
    for (const asset of latest) {
      if (asset) latestAssets.push(asset);
    }
  } catch (err) {
    console.error(`[crypto] latest batch failed: ${err.message}`);
    errors.push({ id: "crypto-batch", error: err.message });
  }

  // ...then one history call per coin (CoinGecko free tier has no batch
  // history endpoint), each merged/upserted into its own file.
  for (const entry of symbols.crypto) {
    try {
      const points = await fetchCryptoHistory(entry);
      const asset = latestAssets.find((a) => a.id === entry.id);
      const todayPoint = asset ? [{ date: todayISO(), price: asset.price }] : [];
      await writeHistory(entry.id, [...points, ...todayPoint]);
      console.log(`[crypto] ${entry.symbol} history updated (${points.length} pts)`);
    } catch (err) {
      console.error(`[crypto] ${entry.symbol} history failed: ${err.message}`);
      errors.push({ id: entry.id, error: err.message });
    }
    await sleep(3000); // CoinGecko free tier rate limit
  }

  const latestPayload = {
    generatedAt: new Date().toISOString(),
    assets: latestAssets,
    errors,
  };
  await writeFile(path.join(DATA_DIR, "latest.json"), JSON.stringify(latestPayload, null, 2) + "\n");

  console.log(`Done. ${latestAssets.length} assets updated, ${errors.length} errors.`);
  if (errors.length === symbols.stocks.length + symbols.crypto.length) {
    process.exitCode = 1; // total failure should fail the CI job
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

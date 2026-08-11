// Client-side data fetching for ETH/USDT perpetual futures from OKX's free,
// no-API-key, CORS-enabled public market data API. Runs directly in the
// browser (no server-side proxy needed).

const BASE = "https://www.okx.com/api/v5";
const INST_ID = "ETH-USDT-SWAP";

export interface Candle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  confirmed: boolean;
}

export interface FundingPoint {
  ts: number;
  rate: number;
}

export interface OiPoint {
  ts: number;
  oiContracts: number;
  oiUsd: number;
}

async function okxGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== "0") throw new Error(`OKX error ${json.code}: ${json.msg}`);
  return json.data as T;
}

function dayBoundsMs(dateStr: string) {
  const startMs = new Date(`${dateStr}T00:00:00`).getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

function isToday(dateStr: string) {
  const today = new Date();
  const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  return dateStr === local;
}

export async function fetchHourlyCandles(dateStr: string): Promise<Candle[]> {
  const { startMs, endMs } = dayBoundsMs(dateStr);

  const raw = isToday(dateStr)
    ? await okxGet<string[][]>("/market/candles", { instId: INST_ID, bar: "1H", limit: "24" })
    : await okxGet<string[][]>("/market/history-candles", {
        instId: INST_ID,
        bar: "1H",
        after: String(endMs + 3_600_000),
        limit: "48",
      });

  return raw
    .map((r) => ({
      ts: Number(r[0]),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
      confirmed: r[8] === "1",
    }))
    .filter((c) => c.ts >= startMs && c.ts < endMs)
    .sort((a, b) => a.ts - b.ts);
}

export async function fetchFundingRate(dateStr: string): Promise<FundingPoint[]> {
  const { startMs, endMs } = dayBoundsMs(dateStr);
  const raw = await okxGet<{ fundingTime: string; fundingRate: string }[]>(
    "/public/funding-rate-history",
    { instId: INST_ID, limit: "100" }
  );
  return raw
    .map((r) => ({ ts: Number(r.fundingTime), rate: Number(r.fundingRate) * 100 }))
    .filter((p) => p.ts >= startMs && p.ts < endMs)
    .sort((a, b) => a.ts - b.ts);
}

export async function fetchOpenInterest(dateStr: string): Promise<OiPoint[]> {
  const { startMs, endMs } = dayBoundsMs(dateStr);
  const raw = await okxGet<string[][]>("/rubik/stat/contracts/open-interest-history", {
    instId: INST_ID,
    period: "1H",
    limit: "100",
  });
  return raw
    .map((r) => ({ ts: Number(r[0]), oiContracts: Number(r[1]), oiUsd: Number(r[3]) }))
    .filter((p) => p.ts >= startMs && p.ts < endMs)
    .sort((a, b) => a.ts - b.ts);
}

export function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

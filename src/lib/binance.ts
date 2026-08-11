// Client-side data fetching for ETH/USDT quarterly futures and options from
// Binance's public REST API. Runs directly in the browser. Binance blocks
// some networks/datacenters (HTTP 451) but was confirmed reachable from the
// deployed app's real users, unlike this project's sandboxed dev environment.

const FAPI = "https://fapi.binance.com/fapi/v1";
const EAPI = "https://eapi.binance.com/eapi/v1";

export interface Candle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  confirmed: boolean;
}

export interface QuarterlyContract {
  symbol: string;
  label: string;
  deliveryDate: number;
}

export interface OptionSymbolInfo {
  symbol: string;
  strike: number;
  side: "C" | "P";
  expiryMs: number;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function dayBoundsMs(dateStr: string) {
  const startMs = new Date(`${dateStr}T00:00:00`).getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

function parseArrayKlines(raw: unknown[][]): Candle[] {
  return raw.map((r) => ({
    ts: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
    confirmed: true,
  }));
}

// --- Quarterly futures (USDⓈ-M futures, fapi) ------------------------------

let quarterlyContractsCache: Promise<QuarterlyContract[]> | null = null;

export function fetchQuarterlyContracts(): Promise<QuarterlyContract[]> {
  if (!quarterlyContractsCache) {
    quarterlyContractsCache = getJson<{
      symbols: {
        symbol: string;
        baseAsset: string;
        quoteAsset: string;
        contractType: string;
        status: string;
        deliveryDate: number;
      }[];
    }>(`${FAPI}/exchangeInfo`).then((info) =>
      info.symbols
        .filter(
          (s) =>
            s.baseAsset === "ETH" &&
            s.quoteAsset === "USDT" &&
            s.status === "TRADING" &&
            (s.contractType === "CURRENT_QUARTER" || s.contractType === "NEXT_QUARTER")
        )
        .map((s) => ({
          symbol: s.symbol,
          deliveryDate: s.deliveryDate,
          label: `Λήξη ${new Date(s.deliveryDate).toLocaleDateString("el-GR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}`,
        }))
        .sort((a, b) => a.deliveryDate - b.deliveryDate)
    );
  }
  return quarterlyContractsCache;
}

export async function fetchQuarterlyCandles(symbol: string, dateStr: string): Promise<Candle[]> {
  const { startMs, endMs } = dayBoundsMs(dateStr);
  const raw = await getJson<unknown[][]>(
    `${FAPI}/klines?symbol=${symbol}&interval=1h&startTime=${startMs}&endTime=${endMs - 1}&limit=24`
  );
  return parseArrayKlines(raw);
}

// --- Options (European options, eapi) ---------------------------------------

let optionSymbolsCache: Promise<OptionSymbolInfo[]> | null = null;

function fetchOptionSymbols(): Promise<OptionSymbolInfo[]> {
  if (!optionSymbolsCache) {
    optionSymbolsCache = getJson<{
      optionSymbols: { symbol: string; underlying: string; strikePrice: string; side: "CALL" | "PUT"; expiryDate: number }[];
    }>(`${EAPI}/exchangeInfo`).then((info) =>
      info.optionSymbols
        .filter((s) => s.underlying === "ETHUSDT")
        .map((s) => ({
          symbol: s.symbol,
          strike: Number(s.strikePrice),
          side: s.side === "CALL" ? ("C" as const) : ("P" as const),
          expiryMs: s.expiryDate,
        }))
    );
  }
  return optionSymbolsCache;
}

export async function fetchOptionExpiries(): Promise<number[]> {
  const symbols = await fetchOptionSymbols();
  return [...new Set(symbols.map((s) => s.expiryMs))].sort((a, b) => a - b);
}

export async function fetchOptionStrikes(expiryMs: number, side: "C" | "P"): Promise<OptionSymbolInfo[]> {
  const symbols = await fetchOptionSymbols();
  return symbols.filter((s) => s.expiryMs === expiryMs && s.side === side).sort((a, b) => a.strike - b.strike);
}

// The EAPI klines endpoint returns an array of objects (unlike spot/futures,
// which return arrays-of-arrays), so it's parsed separately.
export async function fetchOptionCandles(symbol: string, dateStr: string): Promise<Candle[]> {
  const { startMs, endMs } = dayBoundsMs(dateStr);
  const raw = await getJson<
    { open: string; high: string; low: string; close: string; volume: string; openTime: number }[]
  >(`${EAPI}/klines?symbol=${symbol}&interval=1h&startTime=${startMs}&endTime=${endMs - 1}&limit=24`);
  return raw
    .map((r) => ({
      ts: r.openTime,
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: Number(r.volume),
      confirmed: true,
    }))
    .filter((c) => Number.isFinite(c.open) && c.open > 0);
}

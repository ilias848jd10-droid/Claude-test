export type AssetType = "stock" | "crypto";

export interface SymbolEntry {
  id: string;
  symbol: string;
  name: string;
  category: string;
  source: string;
}

export interface SymbolsFile {
  stocks: SymbolEntry[];
  crypto: SymbolEntry[];
}

export interface LatestAsset {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  category: string;
  price: number;
  changePct24h: number | null;
  currency: string;
}

export interface LatestFile {
  generatedAt: string;
  assets: LatestAsset[];
  errors: { id: string; error: string }[];
}

export interface HistoryPoint {
  date: string;
  price: number;
}

// --- KINO ---------------------------------------------------------------

// A single KINO draw (KINO draws every 5 minutes).
export interface KinoDraw {
  drawId: number;
  time: string;
  numbers: number[];
  bonus: number | null;
}

// One row per day: a summary so the overview page doesn't have to load
// every day's full draw list just to list the days.
export interface KinoDaySummary {
  date: string;
  drawCount: number;
  firstDrawId: number | null;
  lastDrawId: number | null;
  closingDraw: KinoDraw | null;
}

export interface KinoNumberCount {
  number: number;
  count: number;
}

export interface KinoOverdue {
  number: number;
  gapDraws: number;
  lastSeenDate: string | null;
  lastSeenTime: string | null;
}

export interface KinoPair {
  numbers: [number, number];
  count: number;
}

export interface KinoLastDraw extends KinoDraw {
  date: string;
}

export interface KinoStats {
  generatedAt: string;
  windowDays: number;
  windowStart: string | null;
  windowEnd: string | null;
  totalDraws: number;
  totalNumbersDrawn: number;
  expectedCountPerNumber: number;
  frequency: KinoNumberCount[];
  hot: KinoNumberCount[];
  cold: KinoNumberCount[];
  overdue: KinoOverdue[];
  topPairs: KinoPair[];
  lastDraw: KinoLastDraw | null;
  disclaimer: string;
  morningSummary: string;
}

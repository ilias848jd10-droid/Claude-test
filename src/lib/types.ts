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

export interface KinoDraw {
  date: string;
  drawId: number;
  time: string;
  numbers: number[];
  bonus: number | null;
}

export interface KinoNumberCount {
  number: number;
  count: number;
}

export interface KinoOverdue {
  number: number;
  gapDraws: number;
  lastSeenDate: string | null;
}

export interface KinoPair {
  numbers: [number, number];
  count: number;
}

export interface KinoStats {
  generatedAt: string;
  windowDays: number;
  windowStart: string | null;
  windowEnd: string | null;
  totalNumbersDrawn: number;
  expectedCountPerNumber: number;
  frequency: KinoNumberCount[];
  hot: KinoNumberCount[];
  cold: KinoNumberCount[];
  overdue: KinoOverdue[];
  topPairs: KinoPair[];
  lastDraw: KinoDraw | null;
  disclaimer: string;
  morningSummary: string;
}

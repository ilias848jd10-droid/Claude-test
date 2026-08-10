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

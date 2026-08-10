import type { HistoryPoint, LatestFile, SymbolsFile } from "./types";

const base = import.meta.env.BASE_URL;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}data/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: HTTP ${res.status}`);
  return res.json();
}

export function fetchSymbols(): Promise<SymbolsFile> {
  return getJson<SymbolsFile>("symbols.json");
}

export function fetchLatest(): Promise<LatestFile> {
  return getJson<LatestFile>("latest.json");
}

export function fetchHistory(id: string): Promise<HistoryPoint[]> {
  return getJson<HistoryPoint[]>(`history/${id}.json`);
}

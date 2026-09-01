import type { HistoryPoint, KinoDaySummary, KinoDraw, KinoStats, LatestFile, SymbolsFile } from "./types";

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

export function fetchKinoHistory(): Promise<KinoDaySummary[]> {
  return getJson<KinoDaySummary[]>("kino/history.json");
}

export function fetchKinoStats(): Promise<KinoStats> {
  return getJson<KinoStats>("kino/stats.json");
}

export function fetchKinoDay(date: string): Promise<KinoDraw[]> {
  return getJson<KinoDraw[]>(`kino/draws/${date}.json`);
}

import { useEffect, useState } from "react";
import { fetchKinoHistory, fetchKinoStats } from "../lib/api";
import type { KinoDraw, KinoStats } from "../lib/types";

export function useKino() {
  const [history, setHistory] = useState<KinoDraw[]>([]);
  const [stats, setStats] = useState<KinoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchKinoHistory(), fetchKinoStats()])
      .then(([historyData, statsData]) => {
        if (cancelled) return;
        setHistory(historyData);
        setStats(statsData);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { history, stats, loading, error };
}

import { useEffect, useState } from "react";
import { fetchLatest } from "../lib/api";
import type { LatestAsset } from "../lib/types";

interface AssetsState {
  assets: LatestAsset[];
  generatedAt: string | null;
  loading: boolean;
  error: string | null;
}

export function useAssets(): AssetsState {
  const [state, setState] = useState<AssetsState>({
    assets: [],
    generatedAt: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetchLatest()
      .then((data) => {
        if (cancelled) return;
        setState({ assets: data.assets, generatedAt: data.generatedAt, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, error: err.message }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

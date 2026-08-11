import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CandlestickChart from "../../components/CandlestickChart";
import { fetchFundingRate, fetchHourlyCandles, fetchOpenInterest, todayDateStr } from "../../lib/okx";
import type { Candle, FundingPoint, OiPoint } from "../../lib/okx";
import { formatCompact, formatHour } from "../../lib/derivFormat";

interface Swing {
  ts: number;
  rangePct: number;
  changePct: number;
}

function computeSwings(candles: Candle[]): Swing[] {
  return candles
    .map((c) => ({
      ts: c.ts,
      rangePct: ((c.high - c.low) / c.open) * 100,
      changePct: ((c.close - c.open) / c.open) * 100,
    }))
    .sort((a, b) => b.rangePct - a.rangePct)
    .slice(0, 5);
}

export default function PerpetualView() {
  const [date, setDate] = useState(todayDateStr());
  const [candles, setCandles] = useState<Candle[]>([]);
  const [funding, setFunding] = useState<FundingPoint[]>([]);
  const [oi, setOi] = useState<OiPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.allSettled([fetchHourlyCandles(date), fetchFundingRate(date), fetchOpenInterest(date)]).then(
      ([candlesRes, fundingRes, oiRes]) => {
        if (cancelled) return;
        setCandles(candlesRes.status === "fulfilled" ? candlesRes.value : []);
        setFunding(fundingRes.status === "fulfilled" ? fundingRes.value : []);
        setOi(oiRes.status === "fulfilled" ? oiRes.value : []);
        if (candlesRes.status === "rejected") {
          setError(candlesRes.reason instanceof Error ? candlesRes.reason.message : "Άγνωστο σφάλμα");
        }
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [date]);

  const swings = useMemo(() => computeSwings(candles), [candles]);

  return (
    <div>
      <p className="last-updated">Ωριαία δεδομένα από OKX &middot; ζωντανά, ανά επιλεγμένη ημερομηνία</p>

      <div className="date-picker-row">
        <label htmlFor="deriv-date-perp">Ημερομηνία</label>
        <input
          id="deriv-date-perp"
          type="date"
          value={date}
          max={todayDateStr()}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {loading && <p className="status-message">Φόρτωση δεδομένων από OKX…</p>}
      {error && (
        <p className="status-message status-critical">
          Σφάλμα φόρτωσης τιμών: {error}. Δοκίμασε άλλη ημερομηνία ή ξαναφόρτωσε τη σελίδα.
        </p>
      )}
      {!loading && !error && candles.length === 0 && (
        <p className="status-message">Δεν βρέθηκαν δεδομένα τιμής για αυτή την ημερομηνία.</p>
      )}

      {candles.length > 0 && (
        <>
          <h2>Τιμή ανά ώρα (candlestick)</h2>
          <div className="chart-panel">
            <CandlestickChart data={candles} />
          </div>

          <h2>Μεγαλύτερες διακυμάνσεις της ημέρας</h2>
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Ώρα</th>
                  <th>Εύρος (high-low)</th>
                  <th>Μεταβολή ώρας</th>
                </tr>
              </thead>
              <tbody>
                {swings.map((s, i) => (
                  <tr key={s.ts} className={i === 0 ? "swing-top" : undefined}>
                    <td>{formatHour(s.ts)}</td>
                    <td>{s.rangePct.toFixed(2)}%</td>
                    <td className={s.changePct >= 0 ? "status-good" : "status-critical"}>
                      {s.changePct >= 0 ? "+" : ""}
                      {s.changePct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Όγκος συναλλαγών ανά ώρα</h2>
          <div className="chart-panel">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={candles} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
                <XAxis
                  dataKey="ts"
                  tickFormatter={formatHour}
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--grid-line)" }}
                />
                <YAxis
                  tickFormatter={formatCompact}
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--grid-line)", borderRadius: 8 }}
                  labelFormatter={(ts) => formatHour(Number(ts))}
                  formatter={(v) => [Number(v).toLocaleString("el-GR"), "Όγκος (ETH)"]}
                />
                <Bar dataKey="volume" fill="var(--series-1)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {oi.length > 0 && (
            <>
              <h2>Open Interest</h2>
              <div className="chart-panel">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={oi} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
                    <XAxis
                      dataKey="ts"
                      tickFormatter={formatHour}
                      tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--grid-line)" }}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => `$${formatCompact(Number(v))}`}
                      tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--grid-line)", borderRadius: 8 }}
                      labelFormatter={(ts) => formatHour(Number(ts))}
                      formatter={(v) => [`$${Number(v).toLocaleString("el-GR")}`, "Open Interest"]}
                    />
                    <Line type="monotone" dataKey="oiUsd" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          {oi.length === 0 && (
            <p className="status-message">
              Δεν υπάρχουν δεδομένα Open Interest για αυτή την ημερομηνία (το OKX κρατά περιορισμένο ιστορικό).
            </p>
          )}

          {funding.length > 0 && (
            <>
              <h2>Funding Rate</h2>
              <div className="chart-panel">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={funding} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
                    <XAxis
                      dataKey="ts"
                      tickFormatter={formatHour}
                      tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--grid-line)" }}
                    />
                    <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip
                      contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--grid-line)", borderRadius: 8 }}
                      labelFormatter={(ts) => formatHour(Number(ts))}
                      formatter={(v) => [`${Number(v).toFixed(4)}%`, "Funding rate"]}
                    />
                    <Bar dataKey="rate" isAnimationActive={false}>
                      {funding.map((f) => (
                        <Cell key={f.ts} fill={f.rate >= 0 ? "var(--status-good)" : "var(--status-critical)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          {funding.length === 0 && (
            <p className="status-message">Δεν υπάρχουν δεδομένα Funding Rate για αυτή την ημερομηνία.</p>
          )}
        </>
      )}
    </div>
  );
}

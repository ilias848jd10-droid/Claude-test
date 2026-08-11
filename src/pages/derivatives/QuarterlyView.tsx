import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CandlestickChart from "../../components/CandlestickChart";
import { fetchQuarterlyCandles, fetchQuarterlyContracts } from "../../lib/binance";
import type { Candle, QuarterlyContract } from "../../lib/binance";
import { formatCompact, formatHour } from "../../lib/derivFormat";

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function QuarterlyView() {
  const [contracts, setContracts] = useState<QuarterlyContract[]>([]);
  const [symbol, setSymbol] = useState<string>("");
  const [date, setDate] = useState(todayDateStr());
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuarterlyContracts()
      .then((list) => {
        setContracts(list);
        if (list.length > 0) setSymbol(list[0].symbol);
        else setError("Δεν βρέθηκαν ενεργά quarterly συμβόλαια ETH/USDT στο Binance αυτή τη στιγμή.");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchQuarterlyCandles(symbol, date)
      .then((data) => {
        if (cancelled) return;
        setCandles(data);
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
  }, [symbol, date]);

  const swings = useMemo(
    () =>
      candles
        .map((c) => ({
          ts: c.ts,
          rangePct: ((c.high - c.low) / c.open) * 100,
          changePct: ((c.close - c.open) / c.open) * 100,
        }))
        .sort((a, b) => b.rangePct - a.rangePct)
        .slice(0, 5),
    [candles]
  );

  return (
    <div>
      <p className="last-updated">
        Ωριαία δεδομένα Quarterly Futures από Binance &middot; ζωντανά, ανά επιλεγμένη ημερομηνία
      </p>

      <div className="date-picker-row">
        <label htmlFor="deriv-quarterly-symbol">Συμβόλαιο</label>
        <select id="deriv-quarterly-symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {contracts.map((c) => (
            <option key={c.symbol} value={c.symbol}>
              {c.symbol} &middot; {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="date-picker-row">
        <label htmlFor="deriv-date-quarterly">Ημερομηνία</label>
        <input
          id="deriv-date-quarterly"
          type="date"
          value={date}
          max={todayDateStr()}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {loading && <p className="status-message">Φόρτωση δεδομένων από Binance…</p>}
      {error && (
        <p className="status-message status-critical">
          Σφάλμα: {error}. Δοκίμασε άλλη ημερομηνία/συμβόλαιο ή ξαναφόρτωσε τη σελίδα.
        </p>
      )}
      {!loading && !error && candles.length === 0 && (
        <p className="status-message">
          Δεν βρέθηκαν δεδομένα για αυτή την ημερομηνία (πιθανόν το συμβόλαιο δεν ήταν ακόμα ενεργό).
        </p>
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
        </>
      )}
    </div>
  );
}

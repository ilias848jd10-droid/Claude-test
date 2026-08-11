import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CandlestickChart from "../../components/CandlestickChart";
import { fetchOptionCandles, fetchOptionExpiries, fetchOptionStrikes } from "../../lib/binance";
import type { Candle, OptionSymbolInfo } from "../../lib/binance";
import { formatCompact, formatHour } from "../../lib/derivFormat";

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatExpiry(ms: number) {
  return new Date(ms).toLocaleDateString("el-GR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function OptionsView() {
  const [expiries, setExpiries] = useState<number[]>([]);
  const [expiry, setExpiry] = useState<number | null>(null);
  const [side, setSide] = useState<"C" | "P">("C");
  const [strikes, setStrikes] = useState<OptionSymbolInfo[]>([]);
  const [symbol, setSymbol] = useState<string>("");
  const [date, setDate] = useState(todayDateStr());
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOptionExpiries()
      .then((list) => {
        setExpiries(list);
        if (list.length > 0) setExpiry(list[0]);
        else setError("Δεν βρέθηκαν ενεργά options ETH/USDT στο Binance αυτή τη στιγμή.");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (expiry == null) return;
    fetchOptionStrikes(expiry, side)
      .then((list) => {
        setStrikes(list);
        setSymbol(list[Math.floor(list.length / 2)]?.symbol ?? "");
      })
      .catch((err: Error) => setError(err.message));
  }, [expiry, side]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOptionCandles(symbol, date)
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
          rangePct: c.open > 0 ? ((c.high - c.low) / c.open) * 100 : 0,
          changePct: c.open > 0 ? ((c.close - c.open) / c.open) * 100 : 0,
        }))
        .sort((a, b) => b.rangePct - a.rangePct)
        .slice(0, 5),
    [candles]
  );

  return (
    <div>
      <p className="last-updated">
        Ωριαία δεδομένα Options από Binance &middot; ζωντανά, ανά επιλεγμένο συμβόλαιο και ημερομηνία
      </p>

      <div className="date-picker-row">
        <label htmlFor="deriv-opt-expiry">Λήξη</label>
        <select
          id="deriv-opt-expiry"
          value={expiry ?? ""}
          onChange={(e) => setExpiry(Number(e.target.value))}
        >
          {expiries.map((e) => (
            <option key={e} value={e}>
              {formatExpiry(e)}
            </option>
          ))}
        </select>
      </div>

      <div className="date-picker-row">
        <label htmlFor="deriv-opt-side">Τύπος</label>
        <select id="deriv-opt-side" value={side} onChange={(e) => setSide(e.target.value as "C" | "P")}>
          <option value="C">Call</option>
          <option value="P">Put</option>
        </select>

        <label htmlFor="deriv-opt-strike">Strike</label>
        <select id="deriv-opt-strike" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {strikes.map((s) => (
            <option key={s.symbol} value={s.symbol}>
              {s.strike}
            </option>
          ))}
        </select>
      </div>

      <div className="date-picker-row">
        <label htmlFor="deriv-date-opt">Ημερομηνία</label>
        <input
          id="deriv-date-opt"
          type="date"
          value={date}
          max={todayDateStr()}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {loading && <p className="status-message">Φόρτωση δεδομένων από Binance…</p>}
      {error && (
        <p className="status-message status-critical">
          Σφάλμα: {error}. Δοκίμασε άλλη επιλογή ή ξαναφόρτωσε τη σελίδα.
        </p>
      )}
      {!loading && !error && symbol && candles.length === 0 && (
        <p className="status-message">
          Δεν βρέθηκαν δεδομένα συναλλαγών για το {symbol} σε αυτή την ημερομηνία (τα options με χαμηλή
          ρευστότητα μπορεί να μην έχουν συναλλαγές κάθε ώρα).
        </p>
      )}

      {candles.length > 0 && (
        <>
          <h2>
            Τιμή ανά ώρα &mdash; {symbol}
          </h2>
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
                  formatter={(v) => [Number(v).toLocaleString("el-GR"), "Όγκος"]}
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

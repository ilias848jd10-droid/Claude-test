import { useKino } from "../hooks/useKino";
import type { KinoNumberCount } from "../lib/types";

function NumberChip({ n, tone }: { n: number; tone?: "hot" | "cold" | "overdue" }) {
  return <span className={`kino-chip ${tone ? `kino-chip-${tone}` : ""}`}>{n}</span>;
}

function CountList({ items, suffix }: { items: KinoNumberCount[]; suffix: string }) {
  return (
    <ul className="kino-count-list">
      {items.map((item) => (
        <li key={item.number}>
          <NumberChip n={item.number} />
          <span className="kino-count-value">
            {item.count}
            {suffix}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Kino() {
  const { history, stats, loading, error } = useKino();

  return (
    <div className="dashboard kino-page">
      <header className="page-header">
        <h1>KINO — Στατιστικά &amp; Ιστορικό</h1>
        {stats && (
          <p className="last-updated">
            Ενημερώθηκε: {new Date(stats.generatedAt).toLocaleString("el-GR")} · Παράθυρο:{" "}
            {stats.windowStart} → {stats.windowEnd} ({stats.windowDays} ημέρες)
          </p>
        )}
      </header>

      <div className="kino-disclaimer">
        ⚠️ Το KINO είναι τυχαία κλήρωση με πιστοποιημένη γεννήτρια τυχαίων αριθμών. Κάθε κλήρωση
        είναι <strong>ανεξάρτητη</strong> από τις προηγούμενες — δεν υπάρχει πραγματικό μαθηματικό
        προβάδισμα από ιστορικά στοιχεία ("gambler's fallacy"). Τα παρακάτω είναι{" "}
        <strong>περιγραφικά στατιστικά</strong> για διασκέδαση, όχι πρόβλεψη.
      </div>

      {loading && <p className="status-message">Φόρτωση δεδομένων KINO…</p>}
      {error && (
        <p className="status-message status-critical">
          Σφάλμα φόρτωσης δεδομένων: {error}. Βεβαιώσου ότι έχει τρέξει το{" "}
          <code>scripts/fetch-kino.mjs</code> και το <code>scripts/analyze-kino.mjs</code>{" "}
          τουλάχιστον μία φορά.
        </p>
      )}

      {stats?.lastDraw && (
        <>
          <h2>Τελευταίο κλείσιμο</h2>
          <p className="last-updated">
            {stats.lastDraw.date} · κλήρωση #{stats.lastDraw.drawId} · {stats.lastDraw.time}
          </p>
          <div className="kino-numbers-grid">
            {stats.lastDraw.numbers.map((n) => (
              <NumberChip key={n} n={n} />
            ))}
          </div>
        </>
      )}

      {stats && (
        <div className="kino-stats-grid">
          <div className="kino-stat-panel">
            <h3>🔥 Πιο "ζεστοί" αριθμοί</h3>
            <CountList items={stats.hot} suffix="×" />
          </div>
          <div className="kino-stat-panel">
            <h3>❄️ Πιο "κρύοι" αριθμοί</h3>
            <CountList items={stats.cold} suffix="×" />
          </div>
          <div className="kino-stat-panel">
            <h3>⏳ Πιο "καθυστερημένοι"</h3>
            <ul className="kino-count-list">
              {stats.overdue.map((o) => (
                <li key={o.number}>
                  <NumberChip n={o.number} />
                  <span className="kino-count-value">{o.gapDraws} ημ.</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="kino-stat-panel">
            <h3>🔗 Συχνά ζευγάρια</h3>
            <ul className="kino-count-list">
              {stats.topPairs.map((p) => (
                <li key={p.numbers.join("-")}>
                  <NumberChip n={p.numbers[0]} />
                  <NumberChip n={p.numbers[1]} />
                  <span className="kino-count-value">{p.count}×</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {stats && (
        <>
          <h2>Συχνότητα ανά αριθμό (1-80)</h2>
          <p className="last-updated">
            Αναμενόμενη συχνότητα σε τυχαία κλήρωση: ~{stats.expectedCountPerNumber.toFixed(1)} φορές
          </p>
          <div className="kino-frequency-grid">
            {stats.frequency.map((f) => {
              const ratio = stats.expectedCountPerNumber ? f.count / stats.expectedCountPerNumber : 1;
              const tone = ratio >= 1.15 ? "hot" : ratio <= 0.85 ? "cold" : undefined;
              return (
                <div key={f.number} className="kino-freq-cell" title={`${f.number}: ${f.count} φορές`}>
                  <NumberChip n={f.number} tone={tone} />
                  <span className="kino-freq-count">{f.count}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <h2>Ιστορικό ημερήσιων κληρώσεων</h2>
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Ημερομηνία</th>
                  <th>Κλήρωση</th>
                  <th>Ώρα</th>
                  <th>Αριθμοί</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((d) => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td>#{d.drawId}</td>
                    <td>{d.time}</td>
                    <td className="kino-history-numbers">{d.numbers.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

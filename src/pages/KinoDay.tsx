import { Link, useParams } from "react-router-dom";
import { useKinoDay } from "../hooks/useKino";

export default function KinoDay() {
  const { date = "" } = useParams();
  const { draws, loading, error } = useKinoDay(date);

  return (
    <div className="dashboard kino-page">
      <Link to="/kino" className="back-link">
        ← Πίσω στο KINO
      </Link>

      <header className="page-header">
        <h1>KINO — {date}</h1>
        {draws.length > 0 && <p className="last-updated">{draws.length} κληρώσεις αυτή την ημέρα</p>}
      </header>

      {loading && <p className="status-message">Φόρτωση κληρώσεων…</p>}
      {error && <p className="status-message status-critical">Σφάλμα φόρτωσης: {error}</p>}

      {draws.length > 0 && (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Κλήρωση</th>
                <th>Ώρα</th>
                <th>Αριθμοί</th>
              </tr>
            </thead>
            <tbody>
              {[...draws].reverse().map((d) => (
                <tr key={d.drawId}>
                  <td>#{d.drawId}</td>
                  <td>{d.time}</td>
                  <td className="kino-history-numbers">{d.numbers.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

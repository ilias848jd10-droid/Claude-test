import { Link, useParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAssets } from "../hooks/useAssets";
import { useHistory } from "../hooks/useHistory";
import { formatPrice } from "../lib/format";

export default function AssetDetail() {
  const { id = "" } = useParams();
  const { assets, loading: assetsLoading } = useAssets();
  const { history, loading: historyLoading, error } = useHistory(id);

  const asset = assets.find((a) => a.id === id);
  const prices = history.map((p) => p.price);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;
  const change = asset?.changePct24h ?? null;
  const positive = (change ?? 0) >= 0;
  const lineColor = "var(--series-1)";

  return (
    <div className="asset-detail">
      <Link to="/" className="back-link">
        ← Πίσω στη λίστα
      </Link>

      {assetsLoading && <p className="status-message">Φόρτωση…</p>}

      {asset && (
        <header className="page-header">
          <h1>
            {asset.name} <span className="asset-symbol-large">{asset.symbol}</span>
          </h1>
          <p className="asset-category">
            {asset.type === "stock" ? "Μετοχή" : "Κρύπτο"} · {asset.category}
          </p>
          <div className="asset-detail-stats">
            <span className="asset-price-large">{formatPrice(asset.price, asset.currency)}</span>
            {change != null && (
              <span className={`asset-change ${positive ? "status-good" : "status-critical"}`}>
                {positive ? "▲" : "▼"} {Math.abs(change).toFixed(2)}% (24ω)
              </span>
            )}
          </div>
        </header>
      )}

      {historyLoading && <p className="status-message">Φόρτωση ιστορικού…</p>}
      {error && <p className="status-message status-critical">Σφάλμα ιστορικού: {error}</p>}

      {history.length > 1 && (
        <>
          <div className="chart-panel" role="img" aria-label={`Γράφημα ιστορικής τιμής για ${asset?.symbol ?? id}`}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={history} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--grid-line)" }}
                  minTickGap={40}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--grid-line)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                  }}
                  formatter={(value) => [formatPrice(Number(value), asset?.currency ?? "USD"), "Τιμή"]}
                />
                <Line type="monotone" dataKey="price" stroke={lineColor} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="stat-row">
            <div className="stat-tile">
              <span className="stat-label">Ελάχιστη ({history.length}ημ.)</span>
              <span className="stat-value">{min != null ? formatPrice(min, asset?.currency ?? "USD") : "—"}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-label">Μέγιστη ({history.length}ημ.)</span>
              <span className="stat-value">{max != null ? formatPrice(max, asset?.currency ?? "USD") : "—"}</span>
            </div>
          </div>

          <h2>Ιστορικό</h2>
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Ημερομηνία</th>
                  <th>Τιμή</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((p) => (
                  <tr key={p.date}>
                    <td>{p.date}</td>
                    <td>{formatPrice(p.price, asset?.currency ?? "USD")}</td>
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

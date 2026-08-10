import { Link } from "react-router-dom";
import Sparkline from "./Sparkline";
import { useHistory } from "../hooks/useHistory";
import { formatPrice } from "../lib/format";
import type { LatestAsset } from "../lib/types";

export default function AssetCard({ asset }: { asset: LatestAsset }) {
  const { history } = useHistory(asset.id);
  const change = asset.changePct24h;
  const positive = (change ?? 0) >= 0;

  return (
    <Link to={`/asset/${asset.id}`} className="asset-card">
      <div className="asset-card-header">
        <div>
          <span className="asset-symbol">{asset.symbol}</span>
          <span className="asset-name">{asset.name}</span>
        </div>
        <span className={`asset-type-badge asset-type-${asset.type}`}>
          {asset.type === "stock" ? "Μετοχή" : "Κρύπτο"}
        </span>
      </div>

      <Sparkline data={history} positive={positive} />

      <div className="asset-card-footer">
        <span className="asset-price">{formatPrice(asset.price, asset.currency)}</span>
        {change != null && (
          <span className={`asset-change ${positive ? "status-good" : "status-critical"}`}>
            {positive ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
          </span>
        )}
      </div>
      <span className="asset-category">{asset.category}</span>
    </Link>
  );
}

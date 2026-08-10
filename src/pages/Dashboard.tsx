import { useMemo, useState } from "react";
import { useAssets } from "../hooks/useAssets";
import AssetCard from "../components/AssetCard";
import SearchBar from "../components/SearchBar";
import CategoryFilter from "../components/CategoryFilter";
import type { AssetType } from "../lib/types";

export default function Dashboard() {
  const { assets, generatedAt, loading, error } = useAssets();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<AssetType | "all">("all");
  const [category, setCategory] = useState("all");

  const categories = useMemo(() => {
    const relevant = type === "all" ? assets : assets.filter((a) => a.type === type);
    return [...new Set(relevant.map((a) => a.category))].sort();
  }, [assets, type]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (type !== "all" && a.type !== type) return false;
      if (category !== "all" && a.category !== category) return false;
      if (q && !a.symbol.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [assets, query, type, category]);

  return (
    <div className="dashboard">
      <header className="page-header">
        <h1>Στατιστικά Μετοχών &amp; Κρύπτο</h1>
        {generatedAt && (
          <p className="last-updated">
            Ενημερώθηκε: {new Date(generatedAt).toLocaleString("el-GR")}
          </p>
        )}
      </header>

      <SearchBar value={query} onChange={setQuery} />
      <CategoryFilter
        type={type}
        onTypeChange={(t) => {
          setType(t);
          setCategory("all");
        }}
        category={category}
        onCategoryChange={setCategory}
        categories={categories}
      />

      {loading && <p className="status-message">Φόρτωση δεδομένων…</p>}
      {error && (
        <p className="status-message status-critical">
          Σφάλμα φόρτωσης δεδομένων: {error}. Βεβαιώσου ότι έχει τρέξει το nightly script τουλάχιστον μία φορά.
        </p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <p className="status-message">Δεν βρέθηκαν αποτελέσματα.</p>
      )}

      <div className="asset-grid">
        {filtered.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>
    </div>
  );
}

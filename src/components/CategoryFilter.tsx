import type { AssetType } from "../lib/types";

interface CategoryFilterProps {
  type: AssetType | "all";
  onTypeChange: (type: AssetType | "all") => void;
  category: string;
  onCategoryChange: (category: string) => void;
  categories: string[];
}

export default function CategoryFilter({
  type,
  onTypeChange,
  category,
  onCategoryChange,
  categories,
}: CategoryFilterProps) {
  return (
    <div className="filters">
      <div className="type-tabs" role="tablist" aria-label="Τύπος περιουσιακού στοιχείου">
        {(["all", "stock", "crypto"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={type === t}
            className={`type-tab ${type === t ? "active" : ""}`}
            onClick={() => onTypeChange(t)}
          >
            {t === "all" ? "Όλα" : t === "stock" ? "Μετοχές" : "Κρύπτο"}
          </button>
        ))}
      </div>

      <select
        className="category-select"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        aria-label="Φίλτρο κατηγορίας"
      >
        <option value="all">Όλες οι κατηγορίες</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}

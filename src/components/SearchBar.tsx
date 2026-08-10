interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Αναζήτηση σύμβολου ή ονόματος (π.χ. AAPL, Bitcoin)…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Αναζήτηση μετοχών και κρύπτο"
      />
    </div>
  );
}

import { useState } from "react";
import PerpetualView from "./derivatives/PerpetualView";
import QuarterlyView from "./derivatives/QuarterlyView";
import OptionsView from "./derivatives/OptionsView";

type DerivType = "perp" | "quarterly" | "options";

const TABS: { id: DerivType; label: string }[] = [
  { id: "perp", label: "Perpetual" },
  { id: "quarterly", label: "Quarterly Futures" },
  { id: "options", label: "Options" },
];

export default function Derivatives() {
  const [type, setType] = useState<DerivType>("perp");

  return (
    <div className="dashboard">
      <header className="page-header">
        <h1>ETH/USDT Παράγωγα</h1>
      </header>

      <div className="type-tabs" role="tablist" aria-label="Τύπος παραγώγου">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={type === t.id}
            className={`type-tab ${type === t.id ? "active" : ""}`}
            onClick={() => setType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type === "perp" && <PerpetualView />}
      {type === "quarterly" && <QuarterlyView />}
      {type === "options" && <OptionsView />}
    </div>
  );
}

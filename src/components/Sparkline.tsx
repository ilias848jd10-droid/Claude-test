import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import type { HistoryPoint } from "../lib/types";

interface SparklineProps {
  data: HistoryPoint[];
  positive: boolean;
}

export default function Sparkline({ data, positive }: SparklineProps) {
  if (data.length < 2) return <div className="sparkline-empty" aria-hidden="true" />;
  const color = positive ? "var(--status-good)" : "var(--status-critical)";

  return (
    <div className="sparkline" role="img" aria-label={`Mini γράφημα τιμής, τελευταίες ${data.length} ημέρες`}>
      <ResponsiveContainer width="100%" height={40}>
        <LineChart data={data}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="price" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

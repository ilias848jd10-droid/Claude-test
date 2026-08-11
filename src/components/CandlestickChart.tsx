import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Candle } from "../lib/okx";

interface CandlestickChartProps {
  data: Candle[];
}

interface ShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: Candle;
}

// recharts renders a Bar for the [low, high] range at pixel rect (x, y, width, height),
// where y is the pixel for `high` and y + height is the pixel for `low`. We derive the
// open/close body position proportionally within that range, so no direct axis-scale
// access is needed.
function CandleShape(props: ShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) return null;
  const { open, high, low, close } = payload;
  const isUp = close >= open;
  const color = isUp ? "var(--status-good)" : "var(--status-critical)";
  const range = high - low || 1;

  const openY = y + height * ((high - open) / range);
  const closeY = y + height * ((high - close) / range);
  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

  const bodyWidth = Math.max(3, width * 0.6);
  const bodyX = x + (width - bodyWidth) / 2;
  const wickX = x + width / 2;

  return (
    <g>
      <line x1={wickX} x2={wickX} y1={y} y2={y + height} stroke={color} strokeWidth={1.5} />
      <rect x={bodyX} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} />
    </g>
  );
}

function formatHour(ts: number) {
  return new Date(ts).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
}

function CandleTooltip({ active, payload }: { active?: boolean; payload?: { payload: Candle }[] }) {
  if (!active || !payload?.length) return null;
  const c = payload[0].payload;
  const changePct = ((c.close - c.open) / c.open) * 100;
  const rangePct = ((c.high - c.low) / c.open) * 100;
  return (
    <div className="candle-tooltip">
      <strong>{formatHour(c.ts)}</strong>
      <div>Άνοιγμα: {c.open.toFixed(2)}</div>
      <div>Μέγιστο: {c.high.toFixed(2)}</div>
      <div>Ελάχιστο: {c.low.toFixed(2)}</div>
      <div>Κλείσιμο: {c.close.toFixed(2)}</div>
      <div className={changePct >= 0 ? "status-good" : "status-critical"}>
        Μεταβολή: {changePct >= 0 ? "+" : ""}
        {changePct.toFixed(2)}%
      </div>
      <div>Εύρος ώρας: {rangePct.toFixed(2)}%</div>
    </div>
  );
}

export default function CandlestickChart({ data }: CandlestickChartProps) {
  const chartData = data.map((c) => ({ ...c, range: [c.low, c.high] as [number, number] }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
        <XAxis
          dataKey="ts"
          tickFormatter={formatHour}
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "var(--grid-line)" }}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip content={<CandleTooltip />} />
        <Bar dataKey="range" shape={CandleShape} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function formatHour(ts: number) {
  return new Date(ts).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat("el-GR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

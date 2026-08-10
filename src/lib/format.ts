export function formatPrice(price: number, currency: string): string {
  let decimals = 2;
  if (price > 0 && price < 1) {
    decimals = Math.min(8, Math.max(2, -Math.floor(Math.log10(price)) + 2));
  }
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

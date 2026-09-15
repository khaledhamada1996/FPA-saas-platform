export const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
export const moneyFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatNumber(value: number | string | null | undefined) {
  return numberFormatter.format(Number(value ?? 0));
}

export function formatMoneyMinor(value: number | string | null | undefined) {
  return moneyFormatter.format(Number(value ?? 0) / 100);
}

export function formatPercent(value: number | string | null | undefined, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toFixed(digits)}%`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

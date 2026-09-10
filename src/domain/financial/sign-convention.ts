export type AccountClass = "revenue" | "cogs" | "opex" | "asset" | "liability" | "equity" | "other_income" | "other_expense";

export function normalizeAmount(accountClass: AccountClass, debit: number, credit: number): number {
  const balance = debit - credit;
  if (accountClass === "revenue" || accountClass === "liability" || accountClass === "equity" || accountClass === "other_income") {
    return -balance;
  }
  return balance;
}

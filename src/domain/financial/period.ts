export type PeriodStatus = "open" | "closed" | "locked";

export interface FinancialPeriod {
  id: string;
  organizationId: string;
  year: number;
  month: number;
  status: PeriodStatus;
}

export function assertValidPeriod(year: number, month: number): void {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error("Invalid financial year");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Invalid financial month");
}

export function canPostToPeriod(status: PeriodStatus): boolean {
  return status === "open";
}

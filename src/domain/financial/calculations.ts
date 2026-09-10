export function addMoney(...values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

export function calculateGrossProfit(revenue: number, cogs: number): number {
  return revenue - cogs;
}

export function calculateEbitda(grossProfit: number, operatingExpenses: number): number {
  return grossProfit - operatingExpenses;
}

export function calculateVariance(actual: number, plan: number): { amount: number; percentage: number | null } {
  const amount = actual - plan;
  return {
    amount,
    percentage: plan === 0 ? null : (amount / Math.abs(plan)) * 100,
  };
}

export function calculateClosingCash(
  openingCash: number,
  expectedCollections: number,
  expectedPayments: number,
  financing: number,
  capex: number,
): number {
  return openingCash + expectedCollections - expectedPayments + financing - capex;
}

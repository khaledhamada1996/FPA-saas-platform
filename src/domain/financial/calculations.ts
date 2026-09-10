export type MoneyMinor = bigint;

export function addMoney(...values: MoneyMinor[]): MoneyMinor {
  return values.reduce((sum, value) => sum + value, 0n);
}

export function calculateGrossProfit(revenue: MoneyMinor, cogs: MoneyMinor): MoneyMinor {
  return revenue - cogs;
}

export function calculateEbitda(
  grossProfit: MoneyMinor,
  operatingExpenses: MoneyMinor,
): MoneyMinor {
  return grossProfit - operatingExpenses;
}

export function calculateVariance(
  actual: MoneyMinor,
  plan: MoneyMinor,
): { amount: MoneyMinor; percentage: number | null } {
  const amount = actual - plan;
  return {
    amount,
    percentage: plan === 0n ? null : (Number(amount) / Number(plan < 0n ? -plan : plan)) * 100,
  };
}

export function calculateClosingCash(
  openingCash: MoneyMinor,
  expectedCollections: MoneyMinor,
  expectedPayments: MoneyMinor,
  financing: MoneyMinor,
  capex: MoneyMinor,
): MoneyMinor {
  return openingCash + expectedCollections - expectedPayments + financing - capex;
}

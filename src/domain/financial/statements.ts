export type ProfitAndLossInputs = {
  revenue: bigint;
  cogs: bigint;
  operatingExpenses: bigint;
  depreciationAndAmortization: bigint;
  financeCost: bigint;
  tax: bigint;
};

export type ProfitAndLoss = ProfitAndLossInputs & {
  grossProfit: bigint;
  ebitda: bigint;
  ebit: bigint;
  ebt: bigint;
  netIncome: bigint;
};

export function calculateProfitAndLoss(input: ProfitAndLossInputs): ProfitAndLoss {
  const grossProfit = input.revenue - input.cogs;
  const ebitda = grossProfit - input.operatingExpenses;
  const ebit = ebitda - input.depreciationAndAmortization;
  const ebt = ebit - input.financeCost;
  const netIncome = ebt - input.tax;

  return { ...input, grossProfit, ebitda, ebit, ebt, netIncome };
}

export type CashForecastInputs = {
  openingCash: bigint;
  expectedCollections: bigint;
  expectedPayments: bigint;
  financing: bigint;
  capex: bigint;
};

export function calculateClosingCash(input: CashForecastInputs): bigint {
  return (
    input.openingCash +
    input.expectedCollections -
    input.expectedPayments +
    input.financing -
    input.capex
  );
}

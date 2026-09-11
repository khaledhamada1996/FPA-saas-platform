import { calculateClosingCash, calculateProfitAndLoss } from "./statements";

describe("calculateProfitAndLoss", () => {
  it("calculates the full P&L deterministically", () => {
    const result = calculateProfitAndLoss({
      revenue: 1_000n,
      cogs: 400n,
      operatingExpenses: 200n,
      depreciationAndAmortization: 50n,
      financeCost: 30n,
      tax: 40n,
    });

    expect(result.grossProfit).toBe(600n);
    expect(result.ebitda).toBe(400n);
    expect(result.ebit).toBe(350n);
    expect(result.ebt).toBe(320n);
    expect(result.netIncome).toBe(280n);
  });
});

describe("calculateClosingCash", () => {
  it("applies the documented cash forecast formula", () => {
    expect(
      calculateClosingCash({
        openingCash: 500n,
        expectedCollections: 300n,
        expectedPayments: 250n,
        financing: 100n,
        capex: 50n,
      }),
    ).toBe(600n);
  });
});

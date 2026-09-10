import {
  addMoney,
  calculateClosingCash,
  calculateEbitda,
  calculateGrossProfit,
  calculateVariance,
} from './calculations';

describe('financial calculations', () => {
  it('adds minor currency units exactly', () => {
    expect(addMoney(100n, 20n, -5n)).toBe(115n);
  });

  it('calculates gross profit deterministically', () => {
    expect(calculateGrossProfit(100000n, 40000n)).toBe(60000n);
  });

  it('calculates EBITDA deterministically', () => {
    expect(calculateEbitda(60000n, 15000n)).toBe(45000n);
  });

  it('calculates variance without floating point money storage', () => {
    const result = calculateVariance(12500n, 10000n);
    expect(result.amount).toBe(2500n);
    expect(result.percentage).toBe(25);
  });

  it('returns null percentage when the plan is zero', () => {
    expect(calculateVariance(100n, 0n)).toEqual({ amount: 100n, percentage: null });
  });

  it('calculates closing cash from cash-flow components', () => {
    expect(calculateClosingCash(10000n, 5000n, 3000n, 2000n, 1000n)).toBe(13000n);
  });
});

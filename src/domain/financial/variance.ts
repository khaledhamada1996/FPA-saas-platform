import { calculateVariance, type MoneyMinor } from "./calculations";

export type VarianceDirection = "favorable" | "unfavorable" | "neutral";

export interface VarianceResult {
  amount: MoneyMinor;
  percentage: number | null;
  direction: VarianceDirection;
}

export function analyzeVariance(
  actual: MoneyMinor,
  plan: MoneyMinor,
  favorableWhenHigher = true,
): VarianceResult {
  const variance = calculateVariance(actual, plan);
  if (variance.amount === 0n) return { ...variance, direction: "neutral" };

  const favorable = favorableWhenHigher ? variance.amount > 0n : variance.amount < 0n;
  return { ...variance, direction: favorable ? "favorable" : "unfavorable" };
}

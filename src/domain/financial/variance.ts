import { calculateVariance } from "./calculations";

export type VarianceDirection = "favorable" | "unfavorable" | "neutral";

export interface VarianceResult {
  amount: number;
  percentage: number | null;
  direction: VarianceDirection;
}

export function analyzeVariance(actual: number, plan: number, favorableWhenHigher = true): VarianceResult {
  const variance = calculateVariance(actual, plan);
  if (variance.amount === 0) return { ...variance, direction: "neutral" };

  const favorable = favorableWhenHigher ? variance.amount > 0 : variance.amount < 0;
  return { ...variance, direction: favorable ? "favorable" : "unfavorable" };
}

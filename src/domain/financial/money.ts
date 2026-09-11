export const MINOR_UNITS_PER_MAJOR = 100n;

export type Money = {
  amountMinor: bigint;
  currency: string;
};

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { amountMinor: left.amountMinor + right.amountMinor, currency: left.currency };
}

export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { amountMinor: left.amountMinor - right.amountMinor, currency: left.currency };
}

export function multiplyMoney(value: Money, multiplier: bigint): Money {
  return { amountMinor: value.amountMinor * multiplier, currency: value.currency };
}

function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new Error(`Currency mismatch: ${left.currency} != ${right.currency}`);
  }
}

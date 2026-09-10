import { normalizeAmount, type AccountClass } from './sign-convention';

describe('financial sign convention', () => {
  const creditNormal: AccountClass[] = ['revenue', 'liability', 'equity', 'other_income'];

  it.each(creditNormal)('normalizes %s as credit-normal', (accountClass) => {
    expect(normalizeAmount(accountClass, 0n, 1000n)).toBe(1000n);
    expect(normalizeAmount(accountClass, 1000n, 0n)).toBe(-1000n);
  });

  it('normalizes debit-normal classes', () => {
    expect(normalizeAmount('asset', 1000n, 0n)).toBe(1000n);
    expect(normalizeAmount('cogs', 1000n, 0n)).toBe(1000n);
    expect(normalizeAmount('opex', 1000n, 0n)).toBe(1000n);
    expect(normalizeAmount('other_expense', 1000n, 0n)).toBe(1000n);
  });
});

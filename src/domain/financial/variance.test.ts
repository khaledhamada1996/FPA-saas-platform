import { analyzeVariance } from './variance';

describe('variance analysis', () => {
  it('marks a positive variance favorable when higher is better', () => {
    expect(analyzeVariance(12500n, 10000n)).toEqual({
      amount: 2500n,
      percentage: 25,
      direction: 'favorable',
    });
  });

  it('marks a positive variance unfavorable when lower is better', () => {
    expect(analyzeVariance(12500n, 10000n, false)).toEqual({
      amount: 2500n,
      percentage: 25,
      direction: 'unfavorable',
    });
  });

  it('returns neutral for zero variance', () => {
    expect(analyzeVariance(10000n, 10000n)).toEqual({
      amount: 0n,
      percentage: 0,
      direction: 'neutral',
    });
  });
});

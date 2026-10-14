import { describe, expect, it } from 'vitest';
import { spinSteps } from './spin';

describe('spinSteps', () => {
  it('always stops on the target', () => {
    for (let count = 2; count <= 4; count++) {
      for (let start = 0; start < count; start++) {
        for (let target = 0; target < count; target++) {
          const steps = spinSteps(count, start, target);
          expect(steps[steps.length - 1].index).toBe(target);
        }
      }
    }
  });

  it('makes at least 16 hops, one item at a time, for 2 or 4 players', () => {
    for (const count of [2, 4]) {
      const steps = spinSteps(count, 1, 1);
      expect(steps.length).toBeGreaterThanOrEqual(16);
      steps.forEach((s, i) => expect(s.index).toBe((1 + i + 1) % count));
    }
  });

  it('lasts about three seconds', () => {
    for (const count of [2, 4]) {
      for (let target = 0; target < count; target++) {
        const total = spinSteps(count, 0, target).reduce((sum, s) => sum + s.delayMs, 0);
        expect(total).toBeGreaterThan(2400);
        expect(total).toBeLessThan(3800);
      }
    }
  });

  it('slows down towards the end', () => {
    const steps = spinSteps(4, 0, 3);
    for (let i = 1; i < steps.length; i++) expect(steps[i].delayMs).toBeGreaterThanOrEqual(steps[i - 1].delayMs);
    expect(steps[steps.length - 1].delayMs).toBeGreaterThan(steps[0].delayMs * 4);
  });

  it('handles one player and none', () => {
    expect(spinSteps(1, 0, 0)).toEqual([{ index: 0, delayMs: 0 }]);
    expect(spinSteps(0, 0, 0)).toEqual([]);
  });
});

// A roulette-style spin over `count` items (DP-022's random first server):
// starting after `start`, the highlight moves one item per step, at least
// `minSteps` times (going round as often as that takes), and stops on
// `target`. Steps start quick and slow down towards the end — about three
// seconds in all, whether there are 2 players or 4. Each step says which
// item to highlight and how long after the previous step it happens.
export type SpinStep = { index: number; delayMs: number };

export function spinSteps(count: number, start: number, target: number, minSteps = 16): SpinStep[] {
  if (count <= 0) return [];
  if (count === 1) return [{ index: 0, delayMs: 0 }];
  const offset = (((target - start) % count) + count) % count;
  const rounds = Math.max(1, Math.ceil((minSteps - offset) / count));
  const total = rounds * count + offset;
  const steps: SpinStep[] = [];
  for (let i = 1; i <= total; i++) {
    const progress = i / total;
    steps.push({ index: (start + i) % count, delayMs: Math.round(70 + 400 * progress * progress * progress) });
  }
  return steps;
}

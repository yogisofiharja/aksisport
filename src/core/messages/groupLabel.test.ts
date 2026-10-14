import { describe, expect, it } from 'vitest';
import { groupLabel } from './groupLabel';

describe('groupLabel', () => {
  it('uses the name when there is one', () => {
    expect(groupLabel('Sunday doubles', ['Ana', 'Budi'], 2)).toBe('Sunday doubles');
  });
  it("lists the other members' names otherwise", () => {
    expect(groupLabel('', ['Ana', 'Budi'], 2)).toBe('Ana, Budi');
    expect(groupLabel('  ', ['Ana', 'Budi', 'Citra'], 3)).toBe('Ana, Budi, Citra');
  });
  it('counts the rest after three names', () => {
    expect(groupLabel('', ['Ana', 'Budi', 'Citra', 'Dewi'], 6)).toBe('Ana, Budi, Citra +3');
  });
});

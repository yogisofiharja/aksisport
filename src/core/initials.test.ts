import { describe, expect, it } from 'vitest';
import { initialsFromName } from './initials';

describe('initialsFromName', () => {
  it('takes the first and last initials', () => {
    expect(initialsFromName('yogi sofi harja')).toBe('YH');
    expect(initialsFromName('Rafa')).toBe('R');
  });

  it('skips brackets, punctuation and emoji-only words', () => {
    expect(initialsFromName('[TEST] Walkthrough Tennis')).toBe('TT');
    expect(initialsFromName('(Jakarta) Padel — 🎾')).toBe('JP');
  });

  it('is empty for a name with no letters', () => {
    expect(initialsFromName('  ')).toBe('');
  });
});

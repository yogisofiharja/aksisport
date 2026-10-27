import { describe, expect, it } from 'vitest';
import { nextCodeValue } from './codeInputValue';

describe('nextCodeValue', () => {
  it('puts a typed digit in its box', () => {
    expect(nextCodeValue('48', 2, '1', '', 6)).toBe('481');
  });

  it('spreads a pasted or autofilled code from the box it lands in', () => {
    expect(nextCodeValue('', 0, '481 920', '', 6)).toBe('481920');
    expect(nextCodeValue('48', 2, '1920', '', 6)).toBe('481920');
  });

  it('never goes past the code length', () => {
    expect(nextCodeValue('4819', 4, '20777', '', 6)).toBe('481920');
  });

  it('replaces a box that already had a digit', () => {
    expect(nextCodeValue('481', 1, '87', '8', 6)).toBe('47');
    expect(nextCodeValue('481', 1, '5', '8', 6)).toBe('45');
  });

  it('clears the box and everything after it when emptied', () => {
    expect(nextCodeValue('481920', 3, '', '9', 6)).toBe('481');
  });
});

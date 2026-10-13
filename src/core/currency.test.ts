import { describe, expect, it } from 'vitest';
import { digitsOnly, formatIDR, formatThousands } from './currency';

describe('formatThousands', () => {
  it('groups digits in threes with dots', () => {
    expect(formatThousands('')).toBe('');
    expect(formatThousands('5')).toBe('5');
    expect(formatThousands('999')).toBe('999');
    expect(formatThousands('1000')).toBe('1.000');
    expect(formatThousands('150000')).toBe('150.000');
    expect(formatThousands('1234567')).toBe('1.234.567');
  });
});

describe('digitsOnly', () => {
  it('strips separators and anything that is not a digit', () => {
    expect(digitsOnly('150.000')).toBe('150000');
    expect(digitsOnly('1.234.567')).toBe('1234567');
    expect(digitsOnly('12a,3 4')).toBe('1234');
    expect(digitsOnly('')).toBe('');
  });

  it('drops leading zeros but keeps a lone zero', () => {
    expect(digitsOnly('0150')).toBe('150');
    expect(digitsOnly('000')).toBe('0');
  });

  it('round-trips what the field displays', () => {
    expect(digitsOnly(formatThousands('2500000'))).toBe('2500000');
  });
});

describe('formatIDR', () => {
  it('matches the separator the inputs use', () => {
    expect(formatIDR(150000)).toBe(`IDR${formatThousands('150000')}`);
  });
});

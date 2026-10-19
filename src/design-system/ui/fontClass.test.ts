import { describe, expect, it } from 'vitest';
import { hasTextColor, withFontFamily } from './fontClass';

describe('withFontFamily', () => {
  it('defaults to the regular text family', () => {
    expect(withFontFamily('text-sm')).toBe('font-sans text-sm');
  });

  it('turns a weight class into the matching text family', () => {
    expect(withFontFamily('font-sans text-lg font-bold')).toBe('font-sans-bold text-lg');
    expect(withFontFamily('font-semibold')).toBe('font-sans-semibold');
    expect(withFontFamily('font-medium')).toBe('font-sans-medium');
  });

  it('caps the heavier weights at bold', () => {
    expect(withFontFamily('font-extrabold')).toBe('font-sans-bold');
    expect(withFontFamily('font-black')).toBe('font-sans-bold');
  });

  it("lets a caller's weight override a component's base family", () => {
    expect(withFontFamily('font-sans-semibold text-sm font-medium')).toBe('font-sans-medium text-sm');
  });

  it('drops weights on the display face, which has one weight', () => {
    expect(withFontFamily('text-3xl font-display font-black')).toBe('font-display text-3xl');
    expect(withFontFamily('font-display-hero font-bold')).toBe('font-display-hero');
  });

  it('keeps an explicit family given after a weight', () => {
    expect(withFontFamily('font-bold font-display')).toBe('font-display');
    expect(withFontFamily('font-black font-sans')).toBe('font-sans');
  });
});

describe('hasTextColor', () => {
  it('spots colour classes', () => {
    expect(hasTextColor('text-on-heat')).toBe(true);
    expect(hasTextColor('font-bold text-white/70')).toBe(true);
    expect(hasTextColor('dark:text-ink-dark')).toBe(true);
  });

  it('ignores size and alignment', () => {
    expect(hasTextColor('text-sm text-center text-[11px] text-2xl')).toBe(false);
    expect(hasTextColor('')).toBe(false);
  });
});

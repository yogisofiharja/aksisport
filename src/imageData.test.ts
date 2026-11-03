import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-image-picker', () => ({}));
import * as nativePicker from './imagePicker';
import * as webPicker from './imagePicker.web';
import { parseDataUrl } from './imageData';

describe('parseDataUrl', () => {
  it('splits a base64 data URL into contentType and base64', () => {
    expect(parseDataUrl('data:image/png;base64,iVBORw0KGgo=')).toEqual({ contentType: 'image/png', base64: 'iVBORw0KGgo=' });
  });

  it('rejects anything that is not a base64 data URL', () => {
    expect(parseDataUrl('blob:http://localhost/abc')).toBeNull();
  });
});

// The browser build resolves imagePicker.web.ts; every upload flow imports
// both functions, so both builds must export the same API.
describe('imagePicker builds', () => {
  it('export the same functions on native and web', () => {
    expect(Object.keys(webPicker).sort()).toEqual(Object.keys(nativePicker).sort());
  });
});

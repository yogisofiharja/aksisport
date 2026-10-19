import { describe, expect, it } from 'vitest';
import { withDevHost } from './devHost';

describe('withDevHost', () => {
  it('points a private-network API at the dev host, keeping port and path', () => {
    expect(withDevHost('http://192.168.68.56:8080', '192.168.68.59')).toBe('http://192.168.68.59:8080');
    expect(withDevHost('http://10.0.0.4:8080/api', 'localhost')).toBe('http://localhost:8080/api');
  });

  it('points localhost at the dev host (a phone reaching the Mac)', () => {
    expect(withDevHost('http://localhost:8080', '192.168.68.59')).toBe('http://192.168.68.59:8080');
  });

  it('leaves a public API alone', () => {
    expect(withDevHost('https://api.staging.aksisport.com', 'localhost')).toBe('https://api.staging.aksisport.com');
  });

  it('leaves the URL alone without a dev host', () => {
    expect(withDevHost('http://192.168.68.56:8080', null)).toBe('http://192.168.68.56:8080');
  });
});

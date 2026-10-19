// In development the API runs on the same Mac as Metro, whose network
// address changes whenever the router hands out a new one. Rather than
// editing EXPO_PUBLIC_API_BASE_URL each time, a development build points a
// local API URL (localhost or a private-network address) at the host the
// app itself was loaded from: the page's host on web, Metro's host on a
// phone. Release builds use the configured URL as it is.

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

export function withDevHost(baseUrl: string, devHost: string | null | undefined): string {
  if (!devHost) return baseUrl;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return baseUrl;
  }
  if (!LOCAL_HOST.test(url.hostname)) return baseUrl;
  url.hostname = devHost;
  return url.toString().replace(/\/$/, '');
}

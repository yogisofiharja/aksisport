import { forwardRef, useEffect, useState } from 'react';
import { Image as RNImage, type ImageProps, type ImageSourcePropType } from 'react-native';

// react-native-web renders a plain <img src>, which can't carry request
// headers — so auth-protected images (avatars, receipts, chat photos)
// 401'd on web. A source with `headers` is fetched here with them and
// shown through a blob: URL instead.

type HeaderSource = { uri: string; headers: Record<string, string> };

// One download per URL per page load, shared by every <Image> showing it
// (the same avatar appears in many lists); the browser's HTTP cache
// covers later page loads. A replaced avatar or receipt has a new URL
// (?v=, see imageUrlWithVersion), so neither cache can show a stale one.
const blobUrls = new Map<string, Promise<string | null>>();

function loadWithHeaders({ uri, headers }: HeaderSource): Promise<string | null> {
  let pending = blobUrls.get(uri);
  if (!pending) {
    pending = fetch(uri, { headers })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => (blob ? URL.createObjectURL(blob) : null))
      .catch(() => null)
      .then((url) => {
        // Don't remember failures (e.g. the token wasn't ready yet).
        if (!url) blobUrls.delete(uri);
        return url;
      });
    blobUrls.set(uri, pending);
  }
  return pending;
}

function headerSource(source: ImageSourcePropType | undefined): HeaderSource | null {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const { uri, headers } = source as { uri?: string; headers?: Record<string, string> };
  // `headers` may still be {} while the token loads — wait for it rather
  // than firing an unauthenticated request.
  if (!uri || !headers) return null;
  return { uri, headers };
}

export const Image = forwardRef<RNImage, ImageProps>(function Image({ source, ...rest }, ref) {
  const authed = headerSource(source);
  const uri = authed?.uri;
  const authorization = authed?.headers.Authorization;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    setBlobUrl(null);
    if (!uri || !authorization) return;
    let alive = true;
    loadWithHeaders({ uri, headers: { Authorization: authorization } }).then((url) => {
      if (alive) setBlobUrl(url);
    });
    return () => {
      alive = false;
    };
  }, [uri, authorization]);

  if (!authed) return <RNImage ref={ref} source={source} {...rest} />;
  // Until the bytes arrive, render nothing inside the caller's frame (each
  // call site already draws its own placeholder background/initials).
  return <RNImage ref={ref} source={blobUrl ? { uri: blobUrl } : undefined} {...rest} />;
});

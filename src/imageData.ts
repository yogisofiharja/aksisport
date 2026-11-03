// Platform-neutral helpers shared by imagePicker.ts (native) and
// imagePicker.web.ts (browser). Kept out of either picker so both builds
// export the exact same API — the browser build resolves
// imagePicker.web.ts, which once lacked parseDataUrl and broke every
// upload on web.

// Mirrors the server's isAllowedImageContentType whitelist and
// maxImageBytes cap (server/internal/httpapi/images.go).
export const ALLOWED_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Shared by every image-upload flow (Session Chat, Payment receipts, Club/
// User avatars) — pickImageAsDataUrl's own output format, decoded back into
// the {base64, contentType} shape every upload endpoint expects.
export function parseDataUrl(dataUrl: string): { base64: string; contentType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], base64: match[2] };
}

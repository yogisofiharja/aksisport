import { ALLOWED_IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES } from './imageData';

export { parseDataUrl } from './imageData';

// Longest edge when an image has to be re-encoded — plenty for avatars,
// receipts and chat photos, and keeps the JPEG well under MAX_IMAGE_BYTES.
const MAX_DIMENSION = 2048;

export async function pickImageAsDataUrl(source: 'gallery' | 'camera' = 'gallery'): Promise<string | null> {
  const file = await pickFile(source);
  if (!file) return null;
  // Browsers hand over the original file untouched (unlike the native
  // picker, which compresses to JPEG): a large phone photo, a HEIC or a
  // GIF would be rejected by the server, so re-encode those to JPEG.
  if (ALLOWED_IMAGE_CONTENT_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES) {
    return readAsDataUrl(file);
  }
  return (await reencodeAsJpeg(file)) ?? readAsDataUrl(file);
}

function pickFile(source: 'gallery' | 'camera'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    if (source === 'camera') input.setAttribute('capture', 'environment');

    const cleanup = () => { if (input.parentNode) input.parentNode.removeChild(input); };

    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      resolve(file);
    });
    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    });

    document.body.appendChild(input);
    input.click();
  });
}

function readAsDataUrl(file: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function reencodeAsJpeg(file: File): Promise<string | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // JPEG has no alpha — transparent areas would otherwise turn black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    // The browser can't decode this format (e.g. HEIC outside Safari).
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Web only: draws the match share card as a 1080×1920 JPEG (story size),
// the same design as NativeShareModal's on-screen card — the photo (or the
// plain dark background), a dark gradient over its lower half, the players,
// the score, set scores and the Aksi logo. Drawn directly on a canvas
// rather than copied off the screen, so every browser gets the full card.
// Redesign (Aksi Sport): asphalt background, Saira for the names and score
// (the fonts App.tsx loads), and the Urban Heat Aksi lockup as the branding.

import { color } from '../design-system/foundation/colors';

export type ShareCardContent = {
  teamA: string[];
  teamB: string[];
  score: string;
  breakdown?: string;
  backgroundUri: string | null;
  /** The Urban Heat Aksi lockup (assets/brand/aksi-lockup-heat.png). */
  logoUri: string;
};

const W = 1080;
const H = 1920;
const PAD = 72;
// Stories (Instagram, WhatsApp) cover about the bottom 250px with the
// poster's name and caption, and the top with progress bars: keep the
// text inside the safe middle.
const SAFE_BOTTOM = 300;
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const NAME_FONT = "'Saira-Bold', " + FONT;
const SCORE_FONT = "'Saira-ExtraBoldItalic', " + FONT;
const TEXT_FONT = "'PlusJakartaSans-Bold', " + FONT;
const INK_ON_ASPHALT = color.onAsphalt.light;

// Canvas text silently falls back to the system font if a web font isn't
// ready yet; make sure the card's fonts are.
async function loadFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(
    ["64px 'Saira-Bold'", "230px 'Saira-ExtraBoldItalic'", "40px 'PlusJakartaSans-Bold'", "46px 'PlusJakartaSans-SemiBold'"].map((f) =>
      document.fonts.load(f).catch(() => undefined)
    )
  );
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('background image failed to load'));
    img.src = uri;
  });
}

// Draws `img` covering the whole canvas, cropped to fit, like CSS "cover".
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.max(W / img.width, H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

// The largest bold font size (≤ max) at which every name fits `width`.
function fitNameSize(ctx: CanvasRenderingContext2D, names: string[], width: number, max: number): number {
  let size = max;
  while (size > 24) {
    ctx.font = `${size}px ${NAME_FONT}`;
    if (names.every((n) => ctx.measureText(n).width <= width)) return size;
    size -= 2;
  }
  return size;
}

export async function renderShareCard(content: ShareCardContent): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas not supported');
  await loadFonts();

  // Background
  ctx.fillStyle = color.asphalt.dark;
  ctx.fillRect(0, 0, W, H);
  if (content.backgroundUri) drawCover(ctx, await loadImage(content.backgroundUri));

  // Dark gradient over the lower half, for legible text
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.35, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.65, 'rgba(0,0,0,0.6)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'alphabetic';
  const cx = W / 2;
  let y = H - SAFE_BOTTOM;

  // The Aksi lockup, centred, sitting on the safe line
  const logo = await loadImage(content.logoUri);
  const logoH = 122;
  const logoW = Math.round((logo.width / logo.height) * logoH);
  ctx.drawImage(logo, cx - logoW / 2, y - logoH, logoW, logoH);
  y -= logoH + 64;

  // Set scores
  ctx.textAlign = 'center';
  if (content.breakdown) {
    ctx.font = `46px 'PlusJakartaSans-SemiBold', ${FONT}`;
    ctx.fillStyle = color.inkMuted.dark;
    ctx.fillText(content.breakdown, cx, y);
    y -= 46 + 28;
  }

  // Score
  ctx.font = `230px ${SCORE_FONT}`;
  ctx.fillStyle = INK_ON_ASPHALT;
  ctx.fillText(content.score, cx, y);
  y -= 230 * 0.78 + 56;

  // Players: team A right-aligned left of "VS", team B left-aligned right of it
  const a = content.teamA.map((n) => n.toUpperCase());
  const b = content.teamB.map((n) => n.toUpperCase());
  const vsGap = 52;
  const columnW = W / 2 - PAD - vsGap;
  const nameSize = fitNameSize(ctx, [...a, ...b], columnW, 64);
  const rows = Math.max(a.length, b.length);
  const lineH = Math.round(nameSize * 1.2);
  const top = y - (rows - 1) * lineH;
  ctx.font = `${nameSize}px ${NAME_FONT}`;
  ctx.fillStyle = INK_ON_ASPHALT;
  for (let i = 0; i < rows; i++) {
    const rowY = top + i * lineH;
    if (a[i]) {
      ctx.textAlign = 'right';
      ctx.fillText(a[i], cx - vsGap, rowY);
    }
    if (b[i]) {
      ctx.textAlign = 'left';
      ctx.fillText(b[i], cx + vsGap, rowY);
    }
  }
  ctx.textAlign = 'center';
  ctx.font = `40px ${TEXT_FONT}`;
  ctx.fillStyle = 'rgba(244,242,239,0.5)';
  ctx.fillText('VS', cx, top + ((rows - 1) * lineH) / 2 - (nameSize - 40) / 2);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('could not encode the image');
  return blob;
}

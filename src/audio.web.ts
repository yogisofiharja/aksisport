let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let fetchPromise: Promise<ArrayBuffer | null> | null = null;

export function prefetchAudio(): void {
  if (typeof window === 'undefined') return;
  fetchPromise = fetch('/sounds/applause.mp3')
    .then((r) => r.arrayBuffer())
    .catch(() => null);
}

export function initAudio(): void {
  if (typeof window === 'undefined') return;
  if (ctx) return;
  const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AudioCtx) return;
  ctx = new AudioCtx();
  const pending = fetchPromise
    ?? fetch('/sounds/applause.mp3').then((r) => r.arrayBuffer()).catch(() => null);
  pending
    .then((buf) => {
      if (!buf || !ctx) return;
      ctx.decodeAudioData(
        buf,
        (decoded) => { buffer = decoded; },
        () => {}
      );
    })
    .catch(() => {});
}

export function playApplause(): void {
  if (!ctx || !buffer) return;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.85, ctx.currentTime);
  gain.connect(ctx.destination);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  (ctx.state === 'suspended' ? ctx.resume() : Promise.resolve())
    .then(() => source.start())
    .catch(() => {});
}

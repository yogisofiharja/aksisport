import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let initialized = false;

export function prefetchAudio(): void {
  // expo-audio loads on demand; no prefetch needed for native
}

export function initAudio(): void {
  if (initialized) return;
  initialized = true;
  setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
  }).catch(() => {});
}

export function playApplause(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const player = createAudioPlayer(require('../assets/sounds/applause.mp3'));
    player.play();
    // Player will GC naturally after the short clip finishes
  } catch {
    // ignore playback errors
  }
}

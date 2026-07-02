function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const enVoices = voices.filter((v) => v.lang.startsWith('en'));
  const PREFERRED = ['Samantha', 'Alex', 'Karen', 'Daniel', 'Google US English', 'Google UK English Female'];
  for (const name of PREFERRED) {
    const match = enVoices.find((v) => v.name === name);
    if (match) return match;
  }
  return enVoices.find((v) => v.name.includes('Google')) ?? enVoices[0] ?? null;
}

function makeUtterance(text: string): SpeechSynthesisUtterance {
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'en-US';
  utt.rate = 1.0;
  utt.pitch = 1.0;
  const voice = pickVoice();
  if (voice) utt.voice = voice;
  return utt;
}

export async function loadTTSPreferences(): Promise<void> {}

export function cancelSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function speakText(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.speak(makeUtterance(text));
}

export function speakTextWithCallback(text: string, onDone: () => void): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) { onDone(); return; }
  const utt = makeUtterance(text);
  utt.onend = onDone;
  window.speechSynthesis.speak(utt);
}

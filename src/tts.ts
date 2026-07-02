import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

const VOICE_KEY = 'tts_voice_identifier';
const LANG_KEY = 'tts_language';

let _voiceIdentifier: string | null = null;
let _language = 'en-US';

export async function loadTTSPreferences(): Promise<void> {
  const [voice, lang] = await Promise.all([
    AsyncStorage.getItem(VOICE_KEY),
    AsyncStorage.getItem(LANG_KEY),
  ]);
  if (voice) _voiceIdentifier = voice;
  if (lang) _language = lang;
}

export async function saveTTSPreferences(voiceIdentifier: string | null, language: string): Promise<void> {
  _voiceIdentifier = voiceIdentifier;
  _language = language;
  if (voiceIdentifier) {
    await AsyncStorage.setItem(VOICE_KEY, voiceIdentifier);
  } else {
    await AsyncStorage.removeItem(VOICE_KEY);
  }
  await AsyncStorage.setItem(LANG_KEY, language);
}

export function getTTSPreferences() {
  return { voiceIdentifier: _voiceIdentifier, language: _language };
}

export function cancelSpeech(): void {
  Speech.stop();
}

function speechOptions(extra?: Partial<Speech.SpeechOptions>): Speech.SpeechOptions {
  return {
    language: _language,
    rate: 1.0,
    ...(_voiceIdentifier ? { voice: _voiceIdentifier } : {}),
    ...extra,
  };
}

export function speakText(text: string): void {
  Speech.speak(text, speechOptions());
}

export function speakTextWithCallback(text: string, onDone: () => void): void {
  Speech.speak(text, speechOptions({ onDone }));
}

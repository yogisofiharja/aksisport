// Skia (react-native-skia) requires React Native >= 0.78, but Expo SDK 54
// ships 0.77. Card generation via Skia is therefore unavailable; callers
// should fall back to text-only sharing when this throws.
export async function composeShareCardNative(_opts: {
  backgroundUri?: string;
  matchup: string;
  gameScore: string;
  setBreakdown?: string;
}): Promise<string> {
  throw new Error('Card generation not available on this device');
}

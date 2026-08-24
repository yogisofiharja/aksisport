import * as ImagePicker from 'expo-image-picker';

export async function pickImageAsDataUrl(source: 'gallery' | 'camera' = 'gallery'): Promise<string | null> {
  const { status } = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== 'granted') return null;

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, base64: true })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, base64: true });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (asset.base64) return `data:image/jpeg;base64,${asset.base64}`;
  return asset.uri;
}

// Shared by every image-upload flow (Session Chat, Payment receipts, Club/
// User avatars) — pickImageAsDataUrl's own output format, decoded back into
// the {base64, contentType} shape every upload endpoint expects.
export function parseDataUrl(dataUrl: string): { base64: string; contentType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], base64: match[2] };
}

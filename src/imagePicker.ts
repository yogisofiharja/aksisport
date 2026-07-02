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

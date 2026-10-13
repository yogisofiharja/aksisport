import { Platform, type TextStyle } from 'react-native';

// @react-native-picker/picker renders a bare <select> on web — white and
// unstyled, whatever the theme. This makes it look like the tappable
// value rows the same forms use on native. Returns undefined off web,
// where the native picker styles itself.
export function webSelectStyle(isDark: boolean): TextStyle | undefined {
  if (Platform.OS !== 'web') return undefined;
  return {
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
    color: isDark ? '#f1f5f9' : '#0f172a',
  };
}

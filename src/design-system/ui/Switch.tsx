import { Platform, Switch as RNSwitch, type SwitchProps } from 'react-native';
import { useColorScheme } from 'nativewind';
import { color } from '../foundation/colors';

/**
 * On/off setting that applies immediately (Aksi Sport › Switch): an `ink`
 * track with a `ball` thumb when on (approved 2026-10-21 — heat stays for
 * the one action on a screen), a `border-strong` track with a surface
 * thumb when off. Replaces React Native's platform default (teal on
 * Android and web).
 */
export function Switch({ value, disabled, ...props }: SwitchProps) {
  const { colorScheme } = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const off = color.borderStrong[mode];
  return (
    <RNSwitch
      value={value}
      disabled={disabled}
      trackColor={{ true: color.ink[mode], false: off }}
      thumbColor={value ? color.ball[mode] : color.surface.light}
      // iOS paints the off track from this, not trackColor.false.
      ios_backgroundColor={off}
      // react-native-web: the off thumb and its active colour.
      {...(Platform.OS === 'web' ? ({ activeThumbColor: color.ball[mode] } as object) : null)}
      style={disabled ? { opacity: 0.4 } : undefined}
      {...props}
    />
  );
}

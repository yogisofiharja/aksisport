import { Platform, Switch as RNSwitch, type SwitchProps } from 'react-native';
import { useColorScheme } from 'nativewind';
import { color } from '../foundation/colors';

/**
 * On/off setting that applies immediately (Aksi Sport › Switch): `heat`
 * track with an ink thumb when on, `border-strong` track with a surface
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
      trackColor={{ true: color.heat[mode], false: off }}
      thumbColor={value ? color.onHeat[mode] : color.surface.light}
      // iOS paints the off track from this, not trackColor.false.
      ios_backgroundColor={off}
      // react-native-web: the off thumb and its active colour.
      {...(Platform.OS === 'web' ? ({ activeThumbColor: color.onHeat[mode] } as object) : null)}
      style={disabled ? { opacity: 0.4 } : undefined}
      {...props}
    />
  );
}

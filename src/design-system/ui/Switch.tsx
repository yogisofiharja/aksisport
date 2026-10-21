import { Platform, Switch as RNSwitch, type SwitchProps } from 'react-native';
import { useColorScheme } from 'nativewind';
import { color } from '../foundation/colors';

/**
 * On/off setting that applies immediately (Aksi Sport › Switch): when on,
 * an `ink` track with a `ball` thumb — in dark mode a `ball` track with an
 * ink (#131315) thumb (approved 2026-10-21; heat stays for the one action
 * on a screen); a `border-strong` track with a surface thumb when off. Replaces React Native's platform default (teal on
 * Android and web).
 */
export function Switch({ value, disabled, ...props }: SwitchProps) {
  const { colorScheme } = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const off = color.borderStrong[mode];
  // On: ink track, ball knob in light mode; in dark mode (where ink is
  // near-white) a ball track with an ink knob, so the knob stays visible.
  const onTrack = mode === 'dark' ? color.ball.dark : color.ink.light;
  const onThumb = mode === 'dark' ? color.ink.light : color.ball.light;
  return (
    <RNSwitch
      value={value}
      disabled={disabled}
      trackColor={{ true: onTrack, false: off }}
      thumbColor={value ? onThumb : color.surface.light}
      // iOS paints the off track from this, not trackColor.false.
      ios_backgroundColor={off}
      // react-native-web: the off thumb and its active colour.
      {...(Platform.OS === 'web' ? ({ activeThumbColor: onThumb } as object) : null)}
      style={disabled ? { opacity: 0.4 } : undefined}
      {...props}
    />
  );
}

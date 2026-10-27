import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Polygon } from 'react-native-svg';
import { color } from '../foundation/colors';

/**
 * The top of the auth screens (Aksi redesign › Log in): asphalt with heat
 * cuts and the ball at the right, the Aksi logo, a Saira italic title and
 * one line under it. Only on the auth screens, which have no app bar; it
 * runs under the status bar and pads itself by the top inset.
 */

const LOGO = require('../../../assets/brand/aksi-lockup-heat.png');

type AuthHeroProps = {
  title: string;
  subtitle?: string;
  logoLabel?: string;
};

export function AuthHero({ title, subtitle, logoLabel = 'Aksi' }: AuthHeroProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="relative overflow-hidden bg-asphalt dark:bg-asphalt-dark px-6 pb-6 justify-end"
      style={{ minHeight: 280 + insets.top, paddingTop: insets.top + 24 }}
    >
      <View pointerEvents="none" className="absolute right-0 bottom-0">
        <Svg width={240} height={300} viewBox="110 0 240 300">
          <Polygon points="210,300 270,300 450,20 390,20" fill={color.heat.light} />
          <Polygon points="300,300 342,300 482,80 440,80" fill={color.heat.light} opacity={0.45} />
          <Circle cx={330} cy={62} r={16} fill={color.ball.light} />
        </Svg>
      </View>
      <Image source={LOGO} accessibilityLabel={logoLabel} style={{ width: 56, height: 67, marginBottom: 18 }} resizeMode="contain" />
      <Text accessibilityRole="header" className="text-4xl leading-10 font-display-hero text-on-asphalt">
        {title}
      </Text>
      {subtitle ? <Text className="mt-1 text-[15px] leading-[22px] font-sans text-ink-muted-dark">{subtitle}</Text> : null}
    </View>
  );
}

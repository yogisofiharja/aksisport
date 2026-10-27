import { Image, Pressable, Text, View, type ImageSourcePropType } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { initialsFromName } from '../../core/initials';
import { color } from '../foundation/colors';
import { Icon } from '../ui/Icon';

/**
 * The top of a Community's Home tab (Aksi redesign › Community · Home):
 * asphalt with heat cuts at the top right, under the dark AppBar. The
 * Community's picture (or initials) on a ground-coloured square, the name
 * in Saira italic, "<city> · Public", then up to three members' avatars
 * stacked with "24 members", which opens Members.
 *
 * Renders only (DOMAIN_UI.md): pictures need auth headers, so the screen
 * passes the sources; `onPressLogo` is set only for whoever may change
 * the picture.
 */

type Person = { name: string; source?: ImageSourcePropType };

type CommunityHeaderProps = {
  name: string;
  /** "Jakarta Selatan · Public" */
  subline?: string;
  description?: string;
  logoSource?: ImageSourcePropType;
  onPressLogo?: () => void;
  logoLabel?: string;
  people: Person[];
  /** "24 members" */
  membersLabel: string;
  onPressMembers?: () => void;
};

export function CommunityHeader({
  name,
  subline,
  description,
  logoSource,
  onPressLogo,
  logoLabel,
  people,
  membersLabel,
  onPressMembers,
}: CommunityHeaderProps) {
  return (
    <View className="relative overflow-hidden bg-asphalt dark:bg-asphalt-dark px-4 pt-1 pb-5 gap-2.5">
      <View pointerEvents="none" className="absolute -right-10 -top-16">
        <Svg width={220} height={200} viewBox="0 0 220 200">
          <Polygon points="60,200 100,200 220,16 180,16" fill={color.heat.light} />
          <Polygon points="122,200 150,200 250,46 222,46" fill={color.heat.light} opacity={0.45} />
        </Svg>
      </View>
      <Pressable
        onPress={onPressLogo}
        disabled={!onPressLogo}
        accessibilityRole={onPressLogo ? 'button' : undefined}
        accessibilityLabel={onPressLogo ? logoLabel : undefined}
        className="self-start w-14 h-14 rounded-[14px] overflow-hidden items-center justify-center bg-ground active:opacity-80"
      >
        {logoSource ? (
          <Image source={logoSource} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
        ) : (
          <Text className="font-display text-xl text-heat-strong">{initialsFromName(name)}</Text>
        )}
      </Pressable>
      <View>
        <Text accessibilityRole="header" numberOfLines={2} className="font-display-hero text-[34px] leading-[38px] text-on-asphalt">
          {name}
        </Text>
        {subline ? <Text className="text-[13px] leading-[18px] font-sans text-ink-muted-dark">{subline}</Text> : null}
        {description ? (
          <Text numberOfLines={3} className="mt-1.5 text-sm leading-5 font-sans text-on-asphalt/80">
            {description}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onPressMembers}
        disabled={!onPressMembers}
        accessibilityRole={onPressMembers ? 'button' : undefined}
        className="self-start flex-row items-center gap-2 min-h-[36px] active:opacity-70"
      >
        <View className="flex-row">
          {people.slice(0, 3).map((p, i) => (
            <View
              key={i}
              className="w-[26px] h-[26px] rounded-full overflow-hidden items-center justify-center bg-surface-sunken-dark border-2 border-asphalt dark:border-asphalt-dark"
              style={{ marginLeft: i === 0 ? 0 : -8 }}
            >
              {p.source ? (
                <Image source={p.source} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
              ) : (
                <Text className="font-display text-[10px] text-on-asphalt">{initialsFromName(p.name)}</Text>
              )}
            </View>
          ))}
        </View>
        <Text className="text-[13px] font-sans-semibold text-on-asphalt">{membersLabel}</Text>
        {onPressMembers ? <Icon name="chevron-forward" size="xs" color="onDark" /> : null}
      </Pressable>
    </View>
  );
}

import type { ComponentProps } from 'react';
import { Pressable, Text } from 'react-native';
import { elevation } from '../foundation/elevation';
import { Icon } from './Icon';

/**
 * Extended floating action button (Aksi Sport › Button › FAB): one per
 * screen, for its create action (New session on a Community). Heat with
 * an ink label, 56px, radius 12, 16px from the right and above the tab
 * bar; it floats, so it takes the large shadow. Never on a screen that
 * already has a sticky action bar. The screen pads its content so the
 * last card can scroll clear of it.
 */
type FabProps = {
  label: string;
  icon?: ComponentProps<typeof Icon>['name'];
  onPress: () => void;
};

export function Fab({ label, icon = 'add', onPress }: FabProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="absolute right-4 bottom-4 h-14 pl-4 pr-5 rounded-xl bg-heat flex-row items-center gap-2 active:opacity-80"
      style={elevation.high}
    >
      <Icon name={icon} size="lg" color="onBrand" />
      <Text className="text-[15px] font-sans-bold text-on-heat">{label}</Text>
    </Pressable>
  );
}

import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { Sheet } from '../../design-system/feedback/Sheet';
import { Icon } from '../../design-system/ui/Icon';
import { Typography } from '../../design-system/ui/Typography';
import { useTranslation } from '../../i18n';

type IconName = ComponentProps<typeof Icon>['name'];

export type SessionMenuItem = {
  key: string;
  icon: IconName;
  label: string;
  hint?: string;
  destructive?: boolean;
  /** Opens a further screen or sheet: shows a chevron. */
  opensMore?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  items: SessionMenuItem[];
};

// The organizer's ⋯ menu on a Session (Aksi redesign › Organizer menu):
// one row per action with an icon tile, a destructive action last in its
// own group. Picking a row closes the menu first, then runs the action,
// so a confirm Dialog or another Sheet opens on a clean screen.
export function SessionMenuSheet({ visible, onClose, items }: Props) {
  const { t } = useTranslation();
  const safe = items.filter((i) => !i.destructive);
  const destructive = items.filter((i) => i.destructive);

  function pick(item: SessionMenuItem) {
    onClose();
    // Let the menu's Modal close before the next overlay opens.
    setTimeout(item.onPress, 250);
  }

  function row(item: SessionMenuItem, first: boolean) {
    return (
      <Pressable
        key={item.key}
        onPress={() => pick(item)}
        accessibilityRole="button"
        className={`flex-row items-center gap-3 min-h-[56px] active:opacity-60 ${
          first ? '' : 'border-t border-border dark:border-border-dark'
        }`}
      >
        <View
          className={`w-10 h-10 rounded-lg items-center justify-center ${
            item.destructive ? 'bg-danger-tint dark:bg-danger-tint-dark' : 'bg-surface-sunken dark:bg-surface-sunken-dark'
          }`}
        >
          <Icon name={item.icon} size="md" color={item.destructive ? 'destructive' : 'default'} />
        </View>
        <View className="flex-1">
          <Typography variant="body" color={item.destructive ? 'destructive' : 'default'} className="font-semibold">
            {item.label}
          </Typography>
          {item.hint ? (
            <Typography variant="body" color="muted" className="text-[13px] leading-[18px]">
              {item.hint}
            </Typography>
          ) : null}
        </View>
        {item.opensMore ? <Icon name="chevron-forward" size="md" color="muted" /> : null}
      </Pressable>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('sessionMenuTitle')}>
      <View>{safe.map((item, i) => row(item, i === 0))}</View>
      {destructive.length > 0 && (
        <>
          <View className="h-1.5 -mx-5 bg-surface-sunken dark:bg-surface-sunken-dark" />
          <View>{destructive.map((item, i) => row(item, i === 0))}</View>
        </>
      )}
    </Sheet>
  );
}

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n';
import { Typography } from '../ui/Typography';
import { CloseOnBack } from './useBackToClose';

/**
 * Bottom sheet (Aksi Sport › Sheet), the default overlay on mobile: action
 * menus, choices, short forms, confirmations with detail.
 *
 * Built on React Native's `Modal`, no new dependency. It closes on a
 * swipe down from the grip or title, a tap on the scrim, and Android back /
 * Escape on web (`onRequestClose`). The header (Aksi redesign › App bar,
 * Sheet) is the grab handle over the title on the left and the dismiss as
 * text on the right: "Close" (or a plain decline the caller passes, such
 * as "Not now") — never "Cancel", which in Aksi always means cancelling
 * something real.
 *
 * Content scrolls inside once it passes 88% of the screen; the bottom is
 * padded by the safe-area inset. On a wide browser window it keeps the
 * app's phone-width column.
 */

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  /** Label for the dismiss text at the top right; `false` hides it. */
  closeLabel?: string | false;
};

const MAX_WIDTH = 640;
const DISMISS_DISTANCE = 80;

export function Sheet({ visible, onClose, title, description, children, closeLabel }: SheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) dragY.setValue(0);
  }, [visible, dragY]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > DISMISS_DISTANCE || g.vy > 1.2) {
            onClose();
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [dragY, onClose]
  );

  const dismiss = closeLabel === false ? null : (closeLabel ?? t('close'));
  const maxHeight = Dimensions.get('window').height * 0.88;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <CloseOnBack onClose={onClose} />
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/50" onPress={onClose} accessibilityLabel={dismiss || t('close')} />
        {/* Classes on a plain View inside: Animated.View doesn't take NativeWind classes. */}
        <Animated.View
          style={{
            width: '100%',
            maxWidth: MAX_WIDTH,
            alignSelf: 'center',
            transform: [{ translateY: dragY }],
          }}
        >
          <View className="bg-surface dark:bg-surface-dark rounded-t-[20px]" style={{ maxHeight }}>
            <View {...pan.panHandlers} className="pt-2">
              <View className="w-9 h-1 rounded-full bg-border-strong dark:bg-border-strong-dark self-center" />
              <View className="flex-row items-center justify-between gap-2 pl-5 pr-2 pt-2 pb-1 min-h-[44px]">
                <Text
                  accessibilityRole="header"
                  className="flex-1 text-[17px] leading-[22px] font-sans-bold text-ink dark:text-ink-dark"
                >
                  {title ?? ''}
                </Text>
                {dismiss ? (
                  <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8} className="px-2 py-2.5 active:opacity-60">
                    <Text className="text-[15px] font-sans-semibold text-ink dark:text-ink-dark">{dismiss}</Text>
                  </Pressable>
                ) : null}
              </View>
              {description ? (
                <Typography variant="body" color="muted" className="px-5" selectable>
                  {description}
                </Typography>
              ) : null}
            </View>
            <ScrollView
              className="px-5"
              contentContainerStyle={{
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 16),
                gap: 12,
              }}
              bounces={false}
            >
              {children}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

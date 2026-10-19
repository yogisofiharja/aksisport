import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n';
import { Button, ButtonText } from '../ui/Button';
import { Typography } from '../ui/Typography';

/**
 * Bottom sheet (Aksi Sport › Sheet), the default overlay on mobile: action
 * menus, choices, short forms, confirmations with detail.
 *
 * Built on React Native's `Modal`, no new dependency. It closes on a
 * swipe down from the grip or title, a tap on the scrim, and Android back /
 * Escape on web (`onRequestClose`). The dismiss button says "Close" (or a
 * plain decline the caller passes, such as "Not now") — never "Cancel",
 * which in Aksi always means cancelling something real.
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
  /** Label for the outlined dismiss button at the bottom; `false` hides it. */
  closeLabel?: string | false;
};

const MAX_WIDTH = 520;
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
            <View {...pan.panHandlers} className="px-5 pt-2.5 pb-1">
              <View className="w-10 h-1 rounded-full bg-border-strong dark:bg-border-strong-dark self-center mb-3" />
              {title ? <Typography variant="title">{title}</Typography> : null}
              {description ? (
                <Typography variant="body" color="muted" className="mt-1">
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
              {dismiss ? (
                <Button variant="outline" size="lg" className="w-full" onPress={onClose}>
                  <ButtonText>{dismiss}</ButtonText>
                </Button>
              ) : null}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

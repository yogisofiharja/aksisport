import type { ReactNode } from 'react';
import { Modal, View } from 'react-native';
import { Card } from '../ui/Card';
import { Button, ButtonText } from '../ui/Button';
import { Typography } from '../ui/Typography';
import { Stack } from '../layout/Stack';
import { HStack } from '../layout/HStack';

/**
 * Unifies three different confirm-dialog implementations found in the app,
 * all doing the same job (destructive/confirm decision, cancel or confirm):
 * - `Alert.alert` (ClubDetailScreen's delete-club, ClubMembersScreen's
 *   remove/leave)
 * - a plain absolute-positioned overlay View (MobileFinalScreen's end
 *   session confirm)
 * - React Native's real `Modal` component (MobileMatchScreen's end-match
 *   confirm, mid-live-scoring)
 *
 * Built on RN's `Modal` (transparent, fade) — the more robust of the three
 * existing approaches (handles the Android back button, proper stacking),
 * matching MobileMatchScreen's implementation rather than the ad hoc
 * overlay View. Declarative (`visible`/`onCancel`/`onConfirm`), matching
 * how both non-Alert call sites already manage dialog state today.
 *
 * Deliberately scoped to the one shape every real call site actually uses
 * — title, optional description, cancel, confirm. Not a generic modal
 * wrapper.
 */

type DialogProps = {
  visible: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function Dialog({
  visible,
  title,
  description,
  icon,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  destructive = false,
  onCancel,
  onConfirm,
}: DialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/55 px-6">
        <Card className="w-full max-w-[320px]" padding="xl">
          <Stack space="md" style={{ alignItems: 'center' }}>
            {icon}
            <Typography variant="title" style={{ textAlign: 'center' }}>
              {title}
            </Typography>
            {description && (
              <Typography variant="body" color="muted" style={{ textAlign: 'center' }}>
                {description}
              </Typography>
            )}
            <HStack space="md" style={{ width: '100%' }}>
              <Button
                variant="outline"
                className="flex-1"
                onPress={onCancel}
              >
                <ButtonText variant="outline">
                  {cancelLabel}
                </ButtonText>
              </Button>
              <Button
                action={destructive ? 'negative' : 'primary'}
                className="flex-1"
                onPress={onConfirm}
              >
                <ButtonText action={destructive ? 'negative' : 'primary'}>{confirmLabel}</ButtonText>
              </Button>
            </HStack>
          </Stack>
        </Card>
      </View>
    </Modal>
  );
}

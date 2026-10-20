import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Button, ButtonText } from '../ui/Button';
import { Typography } from '../ui/Typography';
import { Stack } from '../layout/Stack';
import { HStack } from '../layout/HStack';
import { CloseOnBack } from './useBackToClose';

/**
 * Confirms one destructive or irreversible action (Aksi Sport › Dialog):
 * Cancel session, Remove member, Delete for everyone, Block, End match.
 * Everything else is a Sheet.
 *
 * Title is the question; the description says the consequence. Two
 * buttons side by side: the safe choice (outline) left, the destructive
 * verb (solid danger) right — labels repeat the verb, never "Yes / No".
 * Centred, at most 340px, 20px corners, over the scrim. Built on React
 * Native's `Modal`, so Android back and Escape on web act as the safe
 * choice.
 */

type DialogProps = {
  visible: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  /** Default true: dialogs are for destructive confirms. */
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
  destructive = true,
  onCancel,
  onConfirm,
}: DialogProps) {
  const action = destructive ? 'negative' : 'primary';
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      // Also over the landscape scoring court on iOS.
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <CloseOnBack onClose={onCancel} />
      <View className="flex-1 items-center justify-center px-6">
        <Pressable className="absolute inset-0 bg-black/55" onPress={onCancel} accessibilityLabel={cancelLabel} />
        <View
          className="w-full max-w-[340px] bg-surface dark:bg-surface-dark rounded-[20px] p-6"
          accessibilityRole="alert"
        >
          <Stack space="md">
            {icon}
            <Typography variant="title">{title}</Typography>
            {description ? (
              <Typography variant="body" color="muted">
                {description}
              </Typography>
            ) : null}
            <HStack space="sm" style={{ width: '100%', marginTop: 8 }}>
              <Button variant="outline" className="flex-1" onPress={onCancel}>
                <ButtonText>{cancelLabel}</ButtonText>
              </Button>
              <Button action={action} className="flex-1" onPress={onConfirm}>
                <ButtonText>{confirmLabel}</ButtonText>
              </Button>
            </HStack>
          </Stack>
        </View>
      </View>
    </Modal>
  );
}

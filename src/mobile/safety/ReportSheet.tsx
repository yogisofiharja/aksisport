import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Input, InputField } from '../../design-system/ui/Input';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useTranslation } from '../../i18n';
import { reportMessage, reportUser } from '../../core/safety/api';

export type ReportTarget = { kind: 'user'; userId: string; name: string } | { kind: 'message'; messageId: string; name: string };

type Props = {
  // What is being reported; null closes the sheet.
  target: ReportTarget | null;
  onClose: () => void;
};

const MAX_REASON = 500;

// Report a person or one of their messages, with a short reason (DP-021).
// It goes to the owner and admins of the Communities it concerns.
export function ReportSheet({ target, onClose }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (target) setReason('');
  }, [target]);

  async function handleSend() {
    if (!target || !reason.trim() || sending) return;
    setSending(true);
    try {
      if (target.kind === 'user') await reportUser(target.userId, reason.trim());
      else await reportMessage(target.messageId, reason.trim());
      onClose();
      appAlert(t('reportSentTitle'), t('reportSentBody'));
    } catch {
      appAlert(t('reportFailed'));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable className="flex-1 justify-end bg-black/50 dark:bg-black/70" onPress={onClose}>
          <Pressable
            className="w-full self-center bg-surface dark:bg-surface-dark rounded-t-3xl px-6 pt-6 pb-10 gap-4"
            style={{ maxWidth: 520 }}
            onPress={() => {}}
          >
            <View className="w-10 h-1 rounded-full bg-border-strong dark:bg-border-strong-dark self-center" />
            <VStack space="xs">
              <Typography variant="title">
                {target?.kind === 'message' ? t('reportMessageTitle') : t('reportUserTitle', target?.name ?? '')}
              </Typography>
              <Typography variant="body" color="muted" className="text-sm">
                {t('reportExplainer')}
              </Typography>
            </VStack>
            <Input>
              <InputField
                value={reason}
                onChangeText={setReason}
                placeholder={t('reportReasonPlaceholder')}
                multiline
                maxLength={MAX_REASON}
                textAlignVertical="top"
                style={{ minHeight: 96 }}
                autoFocus
              />
            </Input>
            <HStack space="md">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                <ButtonText variant="outline">
                  {t('clubCancel')}
                </ButtonText>
              </Button>
              <Button action="negative" className="flex-1" onPress={handleSend} disabled={!reason.trim()} loading={sending}>
                <ButtonText>{t('reportSend')}</ButtonText>
              </Button>
            </HStack>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

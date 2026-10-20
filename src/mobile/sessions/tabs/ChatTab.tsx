import { Icon } from '../../../design-system/ui/Icon';
import { HStack, VStack } from '../../../../components/ui/box';
import { Text } from '../../../../components/ui/text';
import { Pressable } from '../../../../components/ui/pressable';
import { useTranslation } from '../../../i18n';
import { SessionChat } from '../SessionChat';
import type { Session } from '../../../core/api/types';

type Props = {
  sessionId: string;
  session: Session;
  onOpenContact: () => void;
};

export function ChatTab({ sessionId, session, onOpenContact }: Props) {
  const { t } = useTranslation();
  return (
    <VStack className="flex-1">
      {/* DP-013 Contact Organizer — private, distinct from the group chat
          below. Everyone gets the same entry point; the modal itself
          decides member (own thread) vs. organizer (thread list) view. */}
      <Pressable
        className="flex-row items-center justify-between px-5 py-3 border-b border-border dark:border-border-dark active:opacity-70"
        onPress={onOpenContact}
      >
        <HStack className="items-center gap-2">
          <Icon name="mail-outline" size="sm" color="secondary" />
          <Text className="font-bold text-ink-muted dark:text-ink-muted-dark">{t('sessionContactEntry')}</Text>
        </HStack>
        <Icon name="chevron-forward" size="sm" color="muted" />
      </Pressable>
      <SessionChat sessionId={sessionId} session={session} />
    </VStack>
  );
}

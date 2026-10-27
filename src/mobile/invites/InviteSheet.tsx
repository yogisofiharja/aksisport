import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Sheet } from '../../design-system/feedback/Sheet';
import { Dialog } from '../../design-system/feedback/Dialog';
import { ListGroup, ListRow } from '../../design-system/ui/List';
import { Input, InputField, InputSlot } from '../../design-system/ui/Input';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Typography } from '../../design-system/ui/Typography';
import { QrCode } from '../../design-system/ui/QrCode';
import { PlayerCard } from '../../design-system/domain-ui/PlayerCard';
import { useTranslation } from '../../i18n';
import { authHeader, userAvatarUrl } from '../../core/api/client';
import {
  getInviteLink,
  inviteUser,
  resetInviteLink,
  searchInviteCandidates,
  type InviteTarget,
} from '../../core/invites/api';
import type { InviteCandidate } from '../../core/invites/types';
import { copyLink, displayLink, inviteLink, shareLink } from '../../platform/shareLink';

type Props = {
  visible: boolean;
  onClose: () => void;
  target: InviteTarget;
  // "Sabtu Pagi Doubles" / "Senayan Tennis Club"
  targetName: string;
  // "Sat 31 Oct, 07:00" — a Session's when, under its name.
  targetWhen?: string;
  // The Session's Community, for the "can join this session only" note.
  clubName?: string;
  // Owners/admins see Reset link.
  canReset: boolean;
};

// Invite friends (DP-028; Aksi redesign › Invite friends sheet): share the
// caller's own link, show it as a QR code, copy it, or invite people on
// Aksi by name. Owners/admins can reset the target's links. The same sheet
// serves a Community and a Session.
export function InviteSheet({ visible, onClose, target, targetName, targetWhen, clubName, canReset }: Props) {
  const { t } = useTranslation();
  const [link, setLink] = useState<string | null>(null);
  const [view, setView] = useState<'main' | 'qr'>('main');
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InviteCandidate[]>([]);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setView('main');
    setCopied(false);
    setError(null);
    authHeader().then(setImageHeaders);
    getInviteLink(target)
      .then((l) => setLink(inviteLink(l.token)))
      .catch(() => setError(t('authGenericError')));
  }, [visible, target.type, target.id]);

  // Search as you type, from 2 characters (the server's minimum).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      searchInviteCandidates(target, q)
        .then((list) => {
          if (seq === searchSeq.current) setResults(list);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [query, target.type, target.id]);

  const shareTitle = t('inviteShareTitle', targetName);

  async function handleShare() {
    if (!link) return;
    const outcome = await shareLink(link, shareTitle);
    if (outcome === 'copied') setCopied(true);
  }

  async function handleCopy() {
    if (!link) return;
    setCopied(await copyLink(link));
  }

  async function handleInvite(user: InviteCandidate) {
    setInvited((prev) => new Set(prev).add(user.id));
    try {
      await inviteUser(target, user.id);
    } catch {
      setInvited((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  }

  async function handleReset() {
    setConfirmReset(false);
    try {
      const fresh = await resetInviteLink(target);
      setLink(inviteLink(fresh.token));
      setCopied(false);
    } catch {
      setError(t('authGenericError'));
    }
  }

  function trailingFor(user: InviteCandidate) {
    if (user.state === 'in') return undefined;
    if (user.state === 'invited' || invited.has(user.id)) {
      return (
        <View className="flex-row items-center gap-1">
          <Icon name="checkmark" size="sm" color="success" />
          <Text className="text-sm font-sans-semibold text-success dark:text-success-dark">{t('inviteInvited')}</Text>
        </View>
      );
    }
    return (
      <Button size="sm" onPress={() => handleInvite(user)} accessibilityLabel={`${t('inviteInvite')} ${user.displayName || user.username}`}>
        <ButtonText>{t('inviteInvite')}</ButtonText>
      </Button>
    );
  }

  const whenLine = [targetWhen, target.type === 'session' ? clubName : null].filter(Boolean).join(' · ');

  if (view === 'qr') {
    return (
      <Sheet visible={visible} onClose={onClose} title={t('inviteScanTitle')}>
        <View className="items-center gap-3.5 px-2 pt-2 pb-2">
          <View className="p-3.5 rounded-[20px] border border-border dark:border-border-dark bg-white">
            {link ? <QrCode value={link} size={220} accessibilityLabel={t('inviteQrLabel', targetName)} /> : <View style={{ width: 220, height: 220 }} />}
          </View>
          <View className="items-center">
            <Text className="text-2xl leading-7 font-display-hero text-ink dark:text-ink-dark text-center">{targetName}</Text>
            {whenLine ? <Typography variant="label" color="muted" className="font-sans mt-1 text-center">{whenLine}</Typography> : null}
          </View>
          <Typography variant="caption" color="muted" className="text-center text-[13px] leading-[18px]">
            {t(target.type === 'session' ? 'inviteQrHintSession' : 'inviteQrHintClub')}
          </Typography>
          <Button variant="outline" size="lg" className="self-stretch mt-2" onPress={handleShare}>
            <ButtonText>{t('inviteShareInstead')}</ButtonText>
          </Button>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('inviteTitle')} description={t('inviteTo', [targetName, targetWhen].filter(Boolean).join(' · '))}>
      <View className="gap-4">
        <ListGroup>
          <ListRow icon="share-outline" title={t('inviteShareLink')} subtitle={t('inviteShareLinkHint')} onPress={handleShare} />
          <ListRow icon="qr-code-outline" title={t('inviteShowQr')} subtitle={t('inviteShowQrHint')} chevron onPress={() => setView('qr')} />
          <ListRow
            icon="copy-outline"
            title={t('inviteCopyLink')}
            subtitle={copied ? t('inviteLinkCopied') : link ? displayLink(link) : undefined}
            onPress={handleCopy}
          />
        </ListGroup>
        {error ? <Text className="text-xs font-sans-semibold text-danger dark:text-danger-dark">{error}</Text> : null}

        <View className="gap-2">
          <Typography variant="overline" color="muted">
            {t('inviteFriendsOnAksi')}
          </Typography>
          <Input>
            <InputSlot className="pr-0">
              <Icon name="search" size="md" color="muted" />
            </InputSlot>
            <InputField
              value={query}
              onChangeText={setQuery}
              placeholder={t('inviteSearchPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('inviteFriendsOnAksi')}
            />
          </Input>
          {results.map((user) => (
            <PlayerCard
              key={user.id}
              inList
              className="px-0"
              name={user.displayName || user.username}
              subtitle={
                user.state === 'in'
                  ? `@${user.username} · ${t(target.type === 'session' ? 'inviteAlreadyPlaying' : 'inviteAlreadyIn')}`
                  : `@${user.username}`
              }
              avatarSource={user.hasAvatar ? { uri: userAvatarUrl(user.id), headers: imageHeaders } : undefined}
              trailing={trailingFor(user)}
            />
          ))}
          {target.type === 'session' && clubName ? (
            <Typography variant="caption" color="muted" className="leading-4">
              {t('inviteSessionOnlyNote', clubName)}
            </Typography>
          ) : null}
        </View>

        {canReset ? (
          <ListGroup>
            <ListRow icon="refresh" title={t('inviteResetLink')} subtitle={t('inviteResetHint')} danger onPress={() => setConfirmReset(true)} />
          </ListGroup>
        ) : null}
      </View>

      <Dialog
        visible={confirmReset}
        title={t('inviteResetConfirmTitle')}
        description={t('inviteResetConfirmDesc')}
        cancelLabel={t('inviteKeepLink')}
        confirmLabel={t('inviteReset')}
        onCancel={() => setConfirmReset(false)}
        onConfirm={handleReset}
      />
    </Sheet>
  );
}

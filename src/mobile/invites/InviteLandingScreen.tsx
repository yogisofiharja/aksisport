import { useEffect, useState } from 'react';
import { Page } from '../../design-system/layout/Page';
import { AppBar } from '../../design-system/layout/AppBar';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { useTranslation } from '../../i18n';
import { ApiRequestError } from '../../core/api/client';
import { openInvite } from '../../core/invites/api';
import type { InviteResolution } from '../../core/invites/types';

type Props = {
  token: string;
  // Replaces this screen with the target, so Back doesn't land here again.
  onResolved: (invite: InviteResolution) => void;
  onHome: () => void;
};

// /i/:token (DP-028). Signed out, the auth screens come first and bring
// the person back here afterwards (restoreIntendedUrl). Signed in, it
// opens the link — which records the invitation, so a non-member can see
// the Session — and goes straight on to the Session or Community.
export function InviteLandingScreen({ token, onResolved, onHome }: Props) {
  const { t } = useTranslation();
  const [problem, setProblem] = useState<'revoked' | 'missing' | 'failed' | null>(null);

  useEffect(() => {
    let cancelled = false;
    openInvite(token)
      .then((invite) => {
        if (!cancelled) onResolved(invite);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError && err.code === 'INVITE_REVOKED') setProblem('revoked');
        else if (err instanceof ApiRequestError && err.status === 404) setProblem('missing');
        else setProblem('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!problem) {
    return (
      <Page appBar={<AppBar onBack={onHome} />}>
        <Loading fullScreen />
      </Page>
    );
  }

  return (
    <Page appBar={<AppBar onBack={onHome} />}>
      <EmptyState
        illustration="no-results"
        title={t(problem === 'revoked' ? 'inviteRevokedTitle' : 'inviteMissingTitle')}
        message={t(problem === 'revoked' ? 'inviteRevoked' : problem === 'missing' ? 'inviteMissing' : 'authGenericError')}
        action={
          <Button variant="outline" onPress={onHome}>
            <ButtonText>{t('inviteGoHome')}</ButtonText>
          </Button>
        }
      />
    </Page>
  );
}

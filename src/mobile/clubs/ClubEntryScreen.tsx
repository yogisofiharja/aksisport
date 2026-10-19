import { useCallback, useState, type ComponentProps } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Page } from '../../design-system/layout/Page';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Loading } from '../../design-system/feedback/Loading';
import { useTranslation } from '../../i18n';
import { getClubPreview } from '../../core/clubs/api';
import { ApiRequestError } from '../../core/api/client';
import type { ClubPreview } from '../../core/api/types';
import { ClubDetailScreen } from './ClubDetailScreen';
import { ClubPreviewScreen } from './ClubPreviewScreen';

type Props = ComponentProps<typeof ClubDetailScreen>;

// What the Community route (`/clubs/:clubId`) actually renders (DP-017).
// The same address is opened by members from Home and by anyone from
// Explore or a shared link, so this asks the server how the caller relates
// to the Community first: members get its home (ClubDetailScreen),
// everyone else the preview with the option to join. Joining a public
// Community flips this to the home in place.
export function ClubEntryScreen(props: Props) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<ClubPreview | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      setPreview(await getClubPreview(props.clubId));
      setNotFound(false);
    } catch (err) {
      // A deleted Community, or a mistyped link. Anything else (offline,
      // server down) keeps whatever is showing; refocusing retries.
      if (err instanceof ApiRequestError && err.status === 404) setNotFound(true);
    }
  }, [props.clubId]);

  // Refocus matters here: a private Community's owner may have approved
  // the request while the person was elsewhere in the app.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (notFound) {
    return (
      <ScrollPage>
        <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={props.onBack}>
          <Icon name="arrow-back" size="lg" />
        </Pressable>
        <Typography variant="heading">{t('clubNotFoundTitle')}</Typography>
        <Typography variant="body" color="muted">
          {t('clubNotFoundDesc')}
        </Typography>
      </ScrollPage>
    );
  }

  if (!preview) {
    return (
      <Page>
        <Loading fullScreen />
      </Page>
    );
  }

  if (preview.viewerRole) return <ClubDetailScreen {...props} />;

  return <ClubPreviewScreen club={preview} onBack={props.onBack} onChanged={setPreview} />;
}

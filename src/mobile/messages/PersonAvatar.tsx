import { Image, View } from 'react-native';
import { Typography } from '../../design-system/ui/Typography';
import { userAvatarUrl } from '../../core/api/client';
import { initialsFromName } from '../../core/initials';

type Props = {
  userId: string;
  name: string;
  hasAvatar: boolean;
  headers: Record<string, string>;
  size?: number;
};

// A person's picture, or their initials.
export function PersonAvatar({ userId, name, hasAvatar, headers, size = 40 }: Props) {
  return (
    <View
      className="rounded-full items-center justify-center overflow-hidden bg-surface-sunken dark:bg-surface-sunken-dark"
      style={{ width: size, height: size }}
    >
      {hasAvatar ? (
        <Image source={{ uri: userAvatarUrl(userId), headers }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Typography variant="body" className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark">
          {initialsFromName(name)}
        </Typography>
      )}
    </View>
  );
}

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

// A group chat's avatar (Aksi redesign › Inbox): the first two members'
// initials, the second overlapping the first. A group of one other
// shows one.
export function GroupAvatar({ names, size = 44 }: { names: string[]; size?: number }) {
  const small = Math.round(size * 0.7);
  const shown = names.slice(0, 2);
  return (
    <View style={{ width: size, height: size }}>
      {shown.map((name, i) => (
        <View
          key={i}
          className={`absolute rounded-full items-center justify-center border-2 border-surface dark:border-surface-dark ${
            i === 0 ? 'bg-surface-sunken dark:bg-surface-sunken-dark' : 'bg-heat-tint dark:bg-heat-tint-dark'
          }`}
          style={{ width: small, height: small, left: i === 0 ? 0 : size - small, top: i === 0 ? 0 : size - small }}
        >
          <Typography
            variant="body"
            className={`text-[11px] font-sans-bold ${i === 0 ? 'text-ink-muted dark:text-ink-muted-dark' : 'text-heat-strong dark:text-heat-strong-dark'}`}
          >
            {initialsFromName(name)}
          </Typography>
        </View>
      ))}
    </View>
  );
}

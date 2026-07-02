import { Pressable as RNPressable, type PressableProps } from 'react-native';

type Props = PressableProps & { className?: string };

export function Pressable({ className, ...props }: Props) {
  return <RNPressable className={className} {...props} />;
}

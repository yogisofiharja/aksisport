import { View, type ViewProps } from 'react-native';

type BoxProps = ViewProps & { className?: string };

export function Box({ className, style, ...props }: BoxProps) {
  return <View className={className} style={style} {...props} />;
}

export function VStack({ className = '', space, ...props }: BoxProps & { space?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const gapMap = { xs: 'gap-1', sm: 'gap-2', md: 'gap-4', lg: 'gap-6' };
  const gap = space ? gapMap[space] : '';
  return <View className={`flex-col ${gap} ${className}`} {...props} />;
}

export function HStack({ className = '', space, ...props }: BoxProps & { space?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const gapMap = { xs: 'gap-1', sm: 'gap-2', md: 'gap-4', lg: 'gap-6' };
  const gap = space ? gapMap[space] : '';
  return <View className={`flex-row items-center ${gap} ${className}`} {...props} />;
}

export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-px bg-border dark:bg-border-dark ${className}`} />;
}

import { Text as RNText, type TextProps } from 'react-native';

type Props = TextProps & { className?: string };

export function Text({ className = '', ...props }: Props) {
  return <RNText className={`text-gray-900 dark:text-slate-100 ${className}`} {...props} />;
}

export function Heading({ className = '', size = 'md', ...props }: Props & { size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' }) {
  const sizeMap = {
    sm: 'text-lg font-extrabold',
    md: 'text-xl font-extrabold',
    lg: 'text-2xl font-black',
    xl: 'text-3xl font-black',
    '2xl': 'text-4xl font-black',
    '3xl': 'text-5xl font-black',
  };
  return <RNText className={`text-gray-900 dark:text-slate-100 tracking-tight ${sizeMap[size]} ${className}`} {...props} />;
}

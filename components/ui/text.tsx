import { Text as RNText, type TextProps } from 'react-native';
import { hasTextColor, withFontFamily } from '../../src/design-system/ui/fontClass';

type Props = TextProps & { className?: string };

// Older text primitives, on the Aksi Sport type and colours: Plus Jakarta
// Sans for Text (weight classes pick the family), Saira for Heading.
export function Text({ className = '', ...props }: Props) {
  const base = hasTextColor(className) ? '' : 'text-ink dark:text-ink-dark';
  return <RNText className={withFontFamily(`${base} ${className}`)} {...props} />;
}

export function Heading({ className = '', size = 'md', ...props }: Props & { size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' }) {
  const sizeMap = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
    '2xl': 'text-[30px] leading-[34px]',
    '3xl': 'text-5xl',
  };
  return (
    <RNText
      className={withFontFamily(
        `font-display ${hasTextColor(className) ? '' : 'text-ink dark:text-ink-dark'} ${sizeMap[size]} ${className}`,
        'font-display'
      )}
      {...props}
    />
  );
}

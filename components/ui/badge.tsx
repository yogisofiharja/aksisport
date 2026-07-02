import { View, Text } from 'react-native';

type Action = 'success' | 'warning' | 'error' | 'info' | 'muted';

const actionClasses: Record<Action, { bg: string; text: string }> = {
  success: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700' },
  error: { bg: 'bg-red-100', text: 'text-red-700' },
  info: { bg: 'bg-blue-100', text: 'text-blue-700' },
  muted: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export function Badge({ action = 'muted', text, className = '' }: { action?: Action; text: string; className?: string }) {
  const { bg, text: textClass } = actionClasses[action];
  return (
    <View className={`${bg} rounded-full px-3 py-1 ${className}`}>
      <Text className={`${textClass} text-xs font-bold`}>{text}</Text>
    </View>
  );
}

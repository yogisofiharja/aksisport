import { useState } from 'react';
import { Pressable, type TextInputProps } from 'react-native';
import { Input, InputField } from './Input';
import { Icon } from './Icon';

/**
 * A password input with a show/hide eye (Aksi Sport › Input): hidden by
 * default; the eye reveals what was typed so a typo can be spotted before
 * submitting. The eye is a 44px target inside the box.
 */

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry'> & {
  isInvalid?: boolean;
  showLabel: string;
  hideLabel: string;
};

export function PasswordInput({ isInvalid, showLabel, hideLabel, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Input isInvalid={isInvalid} className="items-center">
      <InputField {...props} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} />
      <Pressable
        className="w-11 self-stretch items-center justify-center active:opacity-60"
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? hideLabel : showLabel}
      >
        <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size="md" color="muted" />
      </Pressable>
    </Input>
  );
}

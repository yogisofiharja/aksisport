import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, View } from 'react-native';
import { Card } from '../ui/Card';
import { Button, ButtonText } from '../ui/Button';
import { Typography } from '../ui/Typography';
import { Stack } from '../layout/Stack';

/**
 * Drop-in for `Alert.alert` that also works in a browser. react-native-web
 * ships `Alert.alert` as a no-op, so every confirm/choose prompt built on
 * it silently did nothing on web — the action behind it was unreachable.
 *
 * Native keeps the platform's own alert. Web renders the same title /
 * message / buttons in an in-app modal via `AppAlertHost`, mounted once
 * at the app root. Same signature as `Alert.alert`, so call sites don't
 * branch on platform.
 */

export type AppAlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertRequest = { title: string; message?: string; buttons: AppAlertButton[] };

let present: ((request: AlertRequest) => void) | null = null;

export function appAlert(title: string, message?: string, buttons?: AppAlertButton[]) {
  if (Platform.OS !== 'web' || !present) {
    Alert.alert(title, message, buttons);
    return;
  }
  present({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
}

export function AppAlertHost() {
  const [queue, setQueue] = useState<AlertRequest[]>([]);

  useEffect(() => {
    present = (request) => setQueue((q) => [...q, request]);
    return () => {
      present = null;
    };
  }, []);

  const current = queue[0];
  if (Platform.OS !== 'web' || !current) return null;

  function choose(button?: AppAlertButton) {
    setQueue((q) => q.slice(1));
    button?.onPress?.();
  }

  // Dismissing (Escape / browser back) acts as the cancel button when
  // there is one, same as tapping outside a native alert.
  const cancelButton = current.buttons.find((b) => b.style === 'cancel');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => choose(cancelButton)}>
      <View className="flex-1 items-center justify-center bg-black/55 px-6">
        <Card className="w-full max-w-[340px]" padding="xl">
          <Stack space="md">
            <Typography variant="title" style={{ textAlign: 'center' }}>
              {current.title}
            </Typography>
            {current.message ? (
              <Typography variant="body" color="muted" style={{ textAlign: 'center' }}>
                {current.message}
              </Typography>
            ) : null}
            <Stack space="sm">
              {current.buttons.map((button) => {
                const action = button.style === 'destructive' ? 'negative' : 'secondary';
                const variant = button.style === 'cancel' ? 'outline' : 'solid';
                return (
                  <Button key={button.text} action={action} variant={variant} className="w-full" onPress={() => choose(button)}>
                    <ButtonText action={action} variant={variant}>
                      {button.text}
                    </ButtonText>
                  </Button>
                );
              })}
            </Stack>
          </Stack>
        </Card>
      </View>
    </Modal>
  );
}

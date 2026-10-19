import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n';
import { Button, ButtonText } from '../ui/Button';
import { Typography } from '../ui/Typography';
import { Dialog } from './Dialog';
import { Sheet } from './Sheet';

/**
 * `appAlert` keeps `Alert.alert`'s signature, so call sites stay as they
 * are, and `AppAlertHost` (mounted once at the app root) shows each request
 * the Aksi Sport way, on every platform:
 *
 * - a plain message (no buttons, or a single OK) → a **Toast**: asphalt,
 *   at the bottom, gone after about 4 seconds;
 * - one destructive action and a way out → a **Dialog**: safe choice left,
 *   the destructive verb right;
 * - anything else (choices, action menus, a non-destructive confirm) → a
 *   **Sheet**: the actions stacked, destructive ones last, and a dismiss
 *   button that says "Close" rather than "Cancel".
 *
 * `toast()` shows a toast directly, with at most one action (Undo, Retry)
 * in heat-on-asphalt.
 */

export type AppAlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type ToastRequest = {
  id: number;
  message: string;
  detail?: string;
  action?: { label: string; onPress: () => void };
};
type PromptRequest = {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
};

let presentPrompt: ((request: PromptRequest) => void) | null = null;
let presentToast: ((request: ToastRequest) => void) | null = null;
let toastId = 0;

export function toast(
  message: string,
  options?: {
    detail?: string;
    action?: { label: string; onPress: () => void };
  }
) {
  if (!presentToast) {
    Alert.alert(message, options?.detail);
    return;
  }
  presentToast({ id: ++toastId, message, ...options });
}

export function appAlert(title: string, message?: string, buttons?: AppAlertButton[]) {
  const list = buttons ?? [];
  const only = list.length === 1 ? list[0] : null;
  // A message with nothing to decide is a toast; a lone OK runs its
  // follow-up straight away.
  if (list.length === 0 || (only && only.style !== 'destructive' && isAcknowledge(only.text))) {
    toast(title, { detail: message });
    only?.onPress?.();
    return;
  }
  if (!presentPrompt) {
    Alert.alert(title, message, list);
    return;
  }
  presentPrompt({ title, message, buttons: list });
}

function isAcknowledge(text: string) {
  return /^(ok|okay|oke|got it|mengerti)$/i.test(text.trim());
}

export function AppAlertHost() {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<PromptRequest[]>([]);
  const [current, setCurrent] = useState<ToastRequest | null>(null);

  useEffect(() => {
    presentPrompt = (request) => setQueue((q) => [...q, request]);
    presentToast = setCurrent;
    return () => {
      presentPrompt = null;
      presentToast = null;
    };
  }, []);

  const prompt = queue[0];

  function choose(button?: AppAlertButton) {
    setQueue((q) => q.slice(1));
    button?.onPress?.();
  }

  let overlay = null;
  if (prompt) {
    const cancel = prompt.buttons.find((b) => b.style === 'cancel');
    const actions = prompt.buttons.filter((b) => b.style !== 'cancel');
    const genericCancel = !cancel || cancel.text === t('cancel') || cancel.text === t('clubCancel');

    if (actions.length === 1 && actions[0].style === 'destructive') {
      overlay = (
        <Dialog
          visible
          title={prompt.title}
          description={prompt.message}
          cancelLabel={cancel?.text ?? t('cancel')}
          confirmLabel={actions[0].text}
          onCancel={() => choose(cancel)}
          onConfirm={() => choose(actions[0])}
        />
      );
    } else {
      // Destructive options go last, in their own group.
      const safe = actions.filter((b) => b.style !== 'destructive');
      const destructive = actions.filter((b) => b.style === 'destructive');
      overlay = (
        <Sheet
          visible
          title={prompt.title}
          description={prompt.message}
          closeLabel={genericCancel ? t('close') : cancel!.text}
          onClose={() => choose(cancel)}
        >
          {safe.map((button) => (
            <Button
              key={button.text}
              size="lg"
              variant={safe.length === 1 ? 'solid' : 'outline'}
              className="w-full"
              onPress={() => choose(button)}
            >
              <ButtonText>{button.text}</ButtonText>
            </Button>
          ))}
          {destructive.length > 0 && safe.length > 0 && (
            <View className="h-1.5 -mx-5 bg-surface-sunken dark:bg-surface-sunken-dark" />
          )}
          {destructive.map((button) => (
            <Button
              key={button.text}
              size="lg"
              variant="outline"
              action="negative"
              className="w-full"
              onPress={() => choose(button)}
            >
              <ButtonText>{button.text}</ButtonText>
            </Button>
          ))}
        </Sheet>
      );
    }
  }

  return (
    <>
      {overlay}
      {current && (
        <Toast key={current.id} request={current} onDone={() => setCurrent((c) => (c?.id === current.id ? null : c))} />
      )}
    </>
  );
}

// Asphalt in both themes so it stands apart from content; bottom centre,
// clear of the tab bar; 4 seconds, 6 with an action or a second line.
function Toast({ request, onDone }: { request: ToastRequest; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
    const ms = request.action || request.detail ? 6000 : 4000;
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onDone());
    }, ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id]);

  return (
    // Clear of the tab bar or an action bar, plus 16px.
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center px-4" style={{ bottom: insets.bottom + 88 }}>
      <Animated.View style={{ opacity, width: '100%', maxWidth: 360 }} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <View className="flex-row items-center gap-3 rounded-xl bg-asphalt dark:bg-asphalt-dark px-4 py-3">
          <View className="flex-1">
            <Typography variant="label" className="text-on-asphalt">
              {request.message}
            </Typography>
            {request.detail ? (
              <Typography variant="caption" className="text-on-asphalt opacity-75 mt-0.5">
                {request.detail}
              </Typography>
            ) : null}
          </View>
          {request.action ? (
            <Pressable
              hitSlop={8}
              onPress={() => {
                request.action!.onPress();
                onDone();
              }}
              className="active:opacity-60"
            >
              <Typography variant="label" className="text-heat-on-asphalt">
                {request.action.label}
              </Typography>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

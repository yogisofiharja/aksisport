import { Component, type ReactNode } from "react";
import { Platform, View } from "react-native";
import { useTranslation } from "../../i18n";
import { Button, ButtonText } from "../../design-system/ui/Button";
import { EmptyState } from "../../design-system/feedback/EmptyState";
import { reportCrash } from "./reportCrash";

// Catches an error thrown while rendering, reports it, and shows a way
// back instead of a blank screen.
export class CrashBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    // The component stack says which screen and component broke, which a
    // minified JavaScript stack alone doesn't.
    const withComponents =
      error instanceof Error && info.componentStack
        ? Object.assign(new Error(error.message), {
            name: error.name,
            stack: `${error.stack ?? ""}\n\nComponents:${info.componentStack}`,
          })
        : error;
    reportCrash("render", withComponents);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <CrashFallback onRetry={() => this.setState({ failed: false })} />;
  }
}

function CrashFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const retry = () => {
    // On web a reload is the cleanest start; on a phone the app re-renders.
    if (Platform.OS === "web" && typeof window !== "undefined")
      window.location.reload();
    else onRetry();
  };
  return (
    <View className="flex-1 items-center justify-center bg-ground dark:bg-ground-dark">
      <EmptyState
        illustration="offline"
        title={t("crashTitle")}
        message={t("crashMessage")}
        action={
          <Button onPress={retry}>
            <ButtonText>{t("crashRetry")}</ButtonText>
          </Button>
        }
      />
    </View>
  );
}

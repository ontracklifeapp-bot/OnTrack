import { Alert, AlertButton, Platform } from "react-native";

// react-native-web's Alert.alert does nothing, so on web we route it to the
// browser's own alert/confirm dialogs. Imported once from app/_layout.tsx.
if (Platform.OS === "web") {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join("\n\n");
    const cancel = buttons?.find((b) => b.style === "cancel");
    const actions = (buttons ?? []).filter((b) => b !== cancel);

    if (actions.length === 0) {
      window.alert(text);
      cancel?.onPress?.();
      return;
    }
    // Two-choice dialogs (e.g. Cancel / Delete) become OK / Cancel
    if (window.confirm(text)) actions[actions.length - 1].onPress?.();
    else cancel?.onPress?.();
  };
}

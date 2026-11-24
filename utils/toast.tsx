import { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, TouchableOpacity } from "react-native";

type ToastAction = { label: string; onPress: () => void };

export function useToast() {
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<ToastAction | null>(null);
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const useNativeDriver = Platform.OS !== "web";

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver }).start(() => setVisible(false));
  };

  // An action (e.g. Undo) keeps the toast up longer so there's time to tap it
  const showToast = (msg: string, act?: ToastAction) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    setAction(act ?? null);
    setVisible(true);
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver }).start();
    timer.current = setTimeout(hide, act ? 5000 : 2000);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const Toast = visible ? (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Text style={styles.toastText}>{message}</Text>
      {action && (
        <TouchableOpacity onPress={() => { action.onPress(); hide(); }} hitSlop={10}>
          <Text style={styles.actionText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  ) : null;

  return { showToast, Toast };
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#1a1a2e",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  toastText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  actionText: { color: "#8C85FF", fontWeight: "800", fontSize: 14 },
});

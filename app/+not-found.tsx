import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../utils/theme";

// Shown for addresses that don't exist (instead of the default "Unmatched Route" screen)
export default function NotFound() {
  const { colors } = useTheme();
  const s = styles(colors);
  return (
    <View style={s.page}>
      <Text style={s.emoji}>🧭</Text>
      <Text style={s.title}>Page not found</Text>
      <Text style={s.sub}>That link doesn&apos;t go anywhere in OnTrack. It may be old or mistyped.</Text>
      <TouchableOpacity style={s.btn} onPress={() => router.replace("/")} accessibilityRole="button">
        <Text style={s.btnText}>Go to OnTrack</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center", padding: 24 },
  emoji: { fontSize: 52, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "900", color: c.text },
  sub: { fontSize: 15, color: c.textMuted, textAlign: "center", marginTop: 8, maxWidth: 360, lineHeight: 21 },
  btn: { marginTop: 22, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 26 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});

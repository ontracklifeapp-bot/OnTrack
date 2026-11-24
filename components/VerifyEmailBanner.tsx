import { sendEmailVerification } from "firebase/auth";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../firebase/firebase";
import { useTheme } from "../utils/theme";

// Shown to email/password accounts that haven't confirmed their address yet.
// (Google sign-ins are already verified.) The app still works; reminder emails wait.
export default function VerifyEmailBanner() {
  const { colors } = useTheme();
  const [, force] = useState(0);
  const [busy, setBusy] = useState<"send" | "check" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const user = auth.currentUser;
  const usesPassword = !!user?.providerData.some((p) => p.providerId === "password");
  if (!user || user.emailVerified || !usesPassword) return null;

  const resend = async () => {
    setBusy("send");
    try {
      await sendEmailVerification(user);
      setMessage(`Sent! Check ${user.email} (and your spam folder).`);
    } catch (e: any) {
      setMessage(e?.code === "auth/too-many-requests" ? "Already sent recently — check your inbox, or try again in a few minutes." : "Couldn't send it. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    setBusy("check");
    try {
      await user.reload(); // picks up the click on the email link
      if (auth.currentUser?.emailVerified) force((n) => n + 1);
      else setMessage("Not verified yet — click the link in the email first.");
    } finally {
      setBusy(null);
    }
  };

  const s = styles(colors);
  return (
    <View style={s.banner} accessibilityRole="alert">
      <Text style={s.title}>📩 Please confirm your email</Text>
      <Text style={s.text}>
        We sent a link to {user.email}. Confirming it lets us send your reminder emails.
      </Text>
      {!!message && <Text style={s.message}>{message}</Text>}
      <View style={s.row}>
        <TouchableOpacity style={s.btn} onPress={resend} disabled={!!busy} accessibilityRole="button">
          {busy === "send" ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={s.btnText}>Resend email</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={check} disabled={!!busy} accessibilityRole="button">
          {busy === "check" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnPrimaryText}>{"I've verified it"}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  banner: { backgroundColor: c.card, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1.5, borderColor: "#e67e22" },
  title: { fontSize: 15, fontWeight: "800", color: c.text, marginBottom: 4 },
  text: { fontSize: 13, color: c.textSub, lineHeight: 19 },
  message: { fontSize: 13, color: c.accent, fontWeight: "600", marginTop: 6 },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1.5, borderColor: c.accent },
  btnText: { color: c.accent, fontWeight: "700", fontSize: 13 },
  btnPrimary: { backgroundColor: c.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});

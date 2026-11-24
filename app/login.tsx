import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useEffect, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { auth } from "../firebase/firebase";
import { googleSignInAvailable, signInWithGoogle } from "../utils/googleSignIn";
import { useTheme } from "../utils/theme";

export default function LoginScreen() {
  const { colors } = useTheme();
  // /login?mode=register opens straight on "Create Account" (used by the landing page)
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<"login" | "register">(params.mode === "register" ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("savedEmail").then((saved) => { if (saved) setEmail(saved); });
  }, []);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/(tabs)");
    } catch (e: any) {
      if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") return;
      const msg =
        e?.code === "auth/popup-blocked" ? "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again." :
        e?.code === "auth/account-exists-with-different-credential" ? "This email already has an OnTrack account. Sign in with your email and password instead." :
        e?.code === "auth/network-request-failed" ? "No internet connection. Check your connection and try again." :
        "Google sign-in didn't work. Try again, or use your email and password.";
      Alert.alert("Couldn't sign in", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      Alert.alert("Missing name", "Please enter your name.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        // Confirm the address (needed before reminder emails are sent); don't block sign-up if it fails
        sendEmailVerification(cred.user).catch(() => {});
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      await AsyncStorage.setItem("savedEmail", email.trim());
      router.replace("/(tabs)");
    } catch (e: any) {
      const msg =
        e.code === "auth/invalid-credential" || e.code === "auth/user-not-found" || e.code === "auth/wrong-password" ? "Incorrect email or password." :
        e.code === "auth/email-already-in-use" ? "An account with this email already exists." :
        e.code === "auth/weak-password" ? "Password must be at least 6 characters." :
        e.code === "auth/invalid-email" ? "Please enter a valid email address." :
        e.code === "auth/too-many-requests" ? "Too many attempts. Wait a few minutes or reset your password." :
        e.code === "auth/network-request-failed" ? "No internet connection. Check your connection and try again." :
        "Something went wrong. Try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={s.inner}>
        {Platform.OS === "web" && (
          <TouchableOpacity onPress={() => router.replace("/welcome")} style={s.homeLink} accessibilityRole="link">
            <Text style={s.homeLinkText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Image source={require("../assets/images/icon.png")} style={s.logo} />
        <Text style={s.appName}>OnTrack</Text>
        <Text style={s.tagline}>Stay on top of everything</Text>

        <View style={s.toggle}>
          <TouchableOpacity style={[s.toggleBtn, mode === "login" && s.toggleActive]} onPress={() => setMode("login")}>
            <Text style={[s.toggleText, mode === "login" && s.toggleTextActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.toggleBtn, mode === "register" && s.toggleActive]} onPress={() => setMode("register")}>
            <Text style={[s.toggleText, mode === "register" && s.toggleTextActive]}>Create Account</Text>
          </TouchableOpacity>
        </View>

        {mode === "register" && (
          <TextInput style={s.input} placeholder="Your name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} autoCapitalize="words" />
        )}
        <TextInput style={s.input} placeholder="Email address" placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <View style={s.passwordRow}>
          <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Password" placeholderTextColor={colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
            <Text style={s.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
          <Text style={s.submitText}>{loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}</Text>
        </TouchableOpacity>

        {googleSignInAvailable && (
          <>
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>
            <TouchableOpacity style={[s.googleBtn, loading && { opacity: 0.6 }]} onPress={handleGoogle} disabled={loading}>
              <Text style={s.googleG}>G</Text>
              <Text style={s.googleText}>Continue with Google</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === "login" && (
          <TouchableOpacity style={s.forgotBtn} onPress={() => {
            if (!email.trim()) { Alert.alert("Enter your email first", "Type your email address above, then tap Forgot Password."); return; }
            sendPasswordResetEmail(auth, email.trim())
              .then(() => Alert.alert("Check your inbox", `A reset link was sent to ${email.trim()}. Also check your spam folder.`))
              .catch((e: any) => Alert.alert("Error", e?.message || "Could not send reset email. Check the address and try again."));
          }}>
            <Text style={s.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.forgotBtn} onPress={() => router.push("/privacy")}>
          <Text style={s.privacyText}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: "center", marginTop: 8 }} onPress={() => router.push("/terms")}>
          <Text style={s.privacyText}>Terms of Service</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  inner: { flex: 1, justifyContent: "center", padding: 28, width: "100%", maxWidth: 460, alignSelf: "center" },
  homeLink: { alignSelf: "flex-start", marginBottom: 8 },
  homeLinkText: { fontSize: 15, color: c.accent, fontWeight: "600" },
  logo: { width: 120, height: 120, alignSelf: "center", marginBottom: 12, borderRadius: 24 },
  appName: { fontSize: 32, fontWeight: "800", color: c.text, textAlign: "center", marginBottom: 4 },
  tagline: { fontSize: 14, color: c.textMuted, textAlign: "center", marginBottom: 36 },
  toggle: { flexDirection: "row", backgroundColor: c.border, borderRadius: 12, padding: 4, marginBottom: 24 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  toggleActive: { backgroundColor: c.card },
  toggleText: { fontSize: 14, fontWeight: "600", color: c.textMuted },
  toggleTextActive: { color: c.text },
  input: { backgroundColor: c.input, borderRadius: 12, padding: 14, fontSize: 15, color: c.text, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  passwordRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  eyeBtn: { backgroundColor: c.input, borderRadius: 12, padding: 14, justifyContent: "center", alignItems: "center" },
  eyeText: { fontSize: 18 },
  submitBtn: { backgroundColor: c.accent, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8, shadowColor: c.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  forgotBtn: { alignItems: "center", marginTop: 16 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { fontSize: 13, color: c.textMuted },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#dadce0" },
  googleG: { fontSize: 18, fontWeight: "800", color: "#4285F4" },
  googleText: { fontSize: 15, fontWeight: "600", color: "#3c4043" },
  privacyText: { fontSize: 12, color: c.textMuted },
  forgotText: { fontSize: 14, color: c.accent, fontWeight: "600" },
});

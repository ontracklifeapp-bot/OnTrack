import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { deleteUser, EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, signOut, updateProfile, User } from "firebase/auth";
import { deleteDoc, doc, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { auth, db } from "../firebase/firebase";
import { userCol } from "../firebase/userCollection";
import GradebookPicker from "../components/GradebookPicker";
import { useGradebook } from "../utils/gradebook";
import { createCalendarLink, getExistingCalendarLink, googleCalendarUrl, resetCalendarLink, webcalUrl } from "../utils/calendarSync";
import { getEmailReminders, sendTestEmail, setEmailReminders } from "../utils/emailReminders";
import { rescheduleAllNotifications } from "../utils/itemNotifications";
import { getNotificationsEnabled, requestNotificationPermissions, scheduleNotification, setNotificationsEnabled as saveNotificationsEnabled } from "../utils/notifications";
import { useTheme } from "../utils/theme";
import { TOP_GAP } from "../constants/layout";

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  const [emailReminders, setEmailRemindersState] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [gradebook, setGradebook] = useGradebook();
  const [calendarLink, setCalendarLink] = useState<string | null>(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAppleHelp, setShowAppleHelp] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    getNotificationsEnabled().then(setNotificationsEnabled);
    getEmailReminders().then(setEmailRemindersState).catch(() => {});
    getExistingCalendarLink().then(setCalendarLink).catch(() => {});
    return unsub;
  }, []);

  const toggleNotifications = async (v: boolean) => {
    if (v && !(await requestNotificationPermissions())) {
      Alert.alert("Notifications are blocked", "Allow notifications for OnTrack in your phone's Settings, then try again.");
      return;
    }
    setNotificationsEnabled(v);
    await saveNotificationsEnabled(v);
    if (v) rescheduleAllNotifications().catch(() => {});
  };

  const toggleEmailReminders = async (v: boolean) => {
    setEmailRemindersState(v);
    try {
      await setEmailReminders(v);
    } catch {
      setEmailRemindersState(!v);
      Alert.alert("Couldn't save", "Check your connection and try again.");
    }
  };

  const handleTestEmail = async () => {
    setSendingTest(true);
    try {
      await sendTestEmail();
      Alert.alert("Test email sent", `Check ${user?.email} (and your spam folder) in a minute.`);
    } catch (e: any) {
      const msg = e?.code === "functions/resource-exhausted"
        ? "Wait a minute before sending another test email."
        : e?.message === "unverified"
        ? "Confirm your email address first — use the link we sent you (you can resend it from the Home screen)."
        : "Couldn't send the test email. Try again in a moment.";
      Alert.alert("Not sent", msg);
    } finally {
      setSendingTest(false);
    }
  };

  const handleGetCalendarLink = async () => {
    setCalendarBusy(true);
    try {
      setCalendarLink(await createCalendarLink());
    } catch {
      Alert.alert("Couldn't create link", "Check your connection and try again.");
    } finally {
      setCalendarBusy(false);
    }
  };

  const handleCopyLink = async () => {
    if (!calendarLink) return;
    try {
      await navigator.clipboard.writeText(calendarLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert("Your calendar link", calendarLink);
    }
  };

  // webcal:// links hand the feed to the Calendar app. Opening them in a new tab (Linking.openURL)
  // is ignored by Chrome, so on web navigate the current page to it instead.
  const handleAddToApple = () => {
    if (!calendarLink) return;
    setShowAppleHelp(true);
    if (Platform.OS === "web") window.location.href = webcalUrl(calendarLink);
    else Linking.openURL(webcalUrl(calendarLink));
  };

  const handleResetLink = () => {
    Alert.alert(
      "Reset calendar link?",
      "Your current link will stop working. Any calendar using it will stop updating until you add the new link.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: async () => {
          setCalendarBusy(true);
          try { setCalendarLink(await resetCalendarLink()); }
          catch { Alert.alert("Couldn't reset link", "Check your connection and try again."); }
          finally { setCalendarBusy(false); }
        } },
      ]
    );
  };

  // Firebase requires a recent sign-in before deleting an account, so we ask for the password again.
  const handleDeleteAccount = async () => {
    const current = auth.currentUser;
    if (!current?.email || !deletePassword) return;
    setDeleting(true);
    try {
      await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, deletePassword));
      for (const name of ["tasks", "bills", "homework", "reminders", "subjects", "payments", "grades"]) {
        const snap = await getDocs(userCol(name));
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      }
      await deleteDoc(doc(db, "users", current.uid)); // email-reminder settings
      await saveNotificationsEnabled(false); // cancels any scheduled reminders
      await AsyncStorage.multiRemove(["savedEmail", "notificationsEnabled"]);
      await deleteUser(current);
      router.replace("/login");
    } catch (e: any) {
      const msg = e?.code === "auth/invalid-credential" || e?.code === "auth/wrong-password"
        ? "That password is incorrect."
        : "Could not delete your account. Check your connection and try again.";
      Alert.alert("Account not deleted", msg);
    } finally {
      setDeleting(false);
    }
  };

  const initials = user?.displayName
    ? user.displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? "?").toUpperCase();

  const handleSaveName = async () => {
    if (!newName.trim() || !auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: newName.trim() });
    setUser(auth.currentUser);
    setEditingName(false);
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut(auth);
          router.replace("/login");
        },
      },
    ]);
  };

  const s = styles(colors);

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={s.title}>Settings</Text>

      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {editingName ? (
            <View style={s.editNameRow}>
              <TextInput
                style={s.editNameInput}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={handleSaveName}
              />
              <TouchableOpacity style={s.saveNameBtn} onPress={handleSaveName}>
                <Text style={s.saveNameBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingName(false)} style={{ paddingHorizontal: 8 }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => { setNewName(user?.displayName || ""); setEditingName(true); }}>
              <Text style={s.profileName}>{user?.displayName || "Tap to set name"} ✏️</Text>
            </TouchableOpacity>
          )}
          <Text style={s.profileEmail}>{user?.email}</Text>
        </View>
      </View>

      <Text style={s.sectionTitle}>Preferences</Text>
      <View style={s.card}>
        {Platform.OS !== "web" && (
        <View style={[s.row, s.rowBorder, { borderTopWidth: 0 }]}>
          <View>
            <Text style={s.rowLabel}>Push Notifications</Text>
            <Text style={s.rowSub}>Reminders for upcoming due dates</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
        )}
        <View style={[s.row, Platform.OS !== "web" && s.rowBorder]}>
          <View>
            <Text style={s.rowLabel}>{isDark ? "🌙 Dark Mode" : "☀️ Light Mode"}</Text>
            <Text style={s.rowSub}>Toggle app appearance</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
        <View style={[s.row, s.rowBorder]}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={s.rowLabel}>📧 Daily email summary</Text>
            <Text style={s.rowSub}>A 7am email with anything overdue, due today or due tomorrow</Text>
            {emailReminders && (
              <TouchableOpacity onPress={handleTestEmail} disabled={sendingTest} style={{ marginTop: 6 }}>
                <Text style={s.testEmailLink}>{sendingTest ? "Sending…" : "Send me a test email"}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Switch
            value={emailReminders}
            onValueChange={toggleEmailReminders}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <Text style={s.sectionTitle}>School gradebook</Text>
      <View style={[s.card, { padding: 14 }]}>
        <Text style={[s.rowSub, { marginBottom: 10 }]}>Where your school posts grades. OnTrack imports from it with the browser extension.</Text>
        <GradebookPicker value={gradebook} onPick={setGradebook} compact />
      </View>

      <Text style={s.sectionTitle}>Calendar sync</Text>
      <View style={[s.card, { paddingVertical: 14 }]}>
        <Text style={s.rowLabel}>📆 See OnTrack in your calendar</Text>
        <Text style={[s.rowSub, { marginTop: 4, lineHeight: 17 }]}>
          {"Adds everything that's due to Google Calendar, Apple Calendar or Outlook, and keeps it updated. Google refreshes it every few hours."}
        </Text>
        {!calendarLink ? (
          <TouchableOpacity style={[s.calBtn, s.calBtnPrimary, { marginTop: 12 }]} onPress={handleGetCalendarLink} disabled={calendarBusy} accessibilityRole="button">
            {calendarBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.calBtnPrimaryText}>Get my calendar link</Text>}
          </TouchableOpacity>
        ) : (
          <View style={{ marginTop: 12, gap: 8 }}>
            <TouchableOpacity style={[s.calBtn, s.calBtnPrimary]} onPress={() => Linking.openURL(googleCalendarUrl(calendarLink))} accessibilityRole="link">
              <Text style={s.calBtnPrimaryText}>Add to Google Calendar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.calBtn} onPress={handleAddToApple} accessibilityRole="link">
              <Text style={s.calBtnText}>Add to Apple Calendar / Outlook</Text>
            </TouchableOpacity>
            {showAppleHelp && (
              <View style={s.calHelp}>
                <Text style={s.calHelpTitle}>{"Calendar didn't open?"}</Text>
                <Text style={s.calHelpText}>
                  {"1. Click \"Copy link\" below.\n2. Open the Calendar app → File → New Calendar Subscription…\n3. Paste the link and click Subscribe.\n4. Set Auto-refresh to \"Every 5 minutes\" and click OK."}
                </Text>
              </View>
            )}
            {Platform.OS === "web" && (
              <TouchableOpacity style={s.calBtn} onPress={handleCopyLink} accessibilityRole="button">
                <Text style={s.calBtnText}>{copied ? "✓ Copied" : "Copy link"}</Text>
              </TouchableOpacity>
            )}
            <Text style={s.calPrivate}>🔒 Keep this link private: anyone with it can see your due dates.</Text>
            <TouchableOpacity onPress={handleResetLink} disabled={calendarBusy} accessibilityRole="button">
              <Text style={s.calReset}>{calendarBusy ? "Resetting…" : "Reset link"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={s.sectionTitle}>About</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.rowLabel}>App Version</Text>
          <Text style={s.rowValue}>1.0.0</Text>
        </View>
        <TouchableOpacity style={[s.row, s.rowBorder]} onPress={() => router.push("/privacy")}>
          <Text style={s.rowLabel}>Privacy Policy</Text>
          <Text style={s.rowValue}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.row, s.rowBorder]} onPress={() => router.push("/terms")}>
          <Text style={s.rowLabel}>Terms of Service</Text>
          <Text style={s.rowValue}>›</Text>
        </TouchableOpacity>
      </View>

      {__DEV__ && (<>
      <Text style={s.sectionTitle}>Developer</Text>
      <TouchableOpacity
        style={s.testBtn}
        onPress={() => {
          const fiveSecsFromNow = new Date(Date.now() + 5000);
          scheduleNotification("test-notif", "🔔 Test Notification", "Notifications are working!", fiveSecsFromNow);
        }}
      >
        <Text style={s.testBtnText}>Send Test Notification (5s)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={s.testBtn}
        onPress={async () => {
          await AsyncStorage.removeItem("hasSeenOnboarding");
          router.replace("/onboarding");
        }}
      >
        <Text style={s.testBtnText}>🎬 Preview Onboarding</Text>
      </TouchableOpacity>
      </>)}

      <Text style={s.sectionTitle}>Account</Text>
      <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {!showDelete ? (
        <TouchableOpacity style={s.deleteLink} onPress={() => setShowDelete(true)}>
          <Text style={s.deleteLinkText}>Delete account</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.deleteCard}>
          <Text style={s.deleteTitle}>Delete your account?</Text>
          <Text style={s.deleteBody}>
            {"This permanently erases your account and all your tasks, bills, homework and reminders. It can't be undone."}
          </Text>
          <TextInput
            style={s.deleteInput}
            value={deletePassword}
            onChangeText={setDeletePassword}
            placeholder="Enter your password to confirm"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
          />
          <View style={s.deleteBtnRow}>
            <TouchableOpacity style={s.deleteCancelBtn} onPress={() => { setShowDelete(false); setDeletePassword(""); }} disabled={deleting}>
              <Text style={s.deleteCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.deleteConfirmBtn, (!deletePassword || deleting) && { opacity: 0.5 }]} onPress={handleDeleteAccount} disabled={!deletePassword || deleting}>
              {deleting ? <ActivityIndicator color="#fff" /> : <Text style={s.deleteConfirmText}>Delete forever</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={s.footer}>OnTrack · Made with ❤️</Text>
    </ScrollView>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 20 },
  backBtn: { marginTop: TOP_GAP, marginBottom: 8 },
  backText: { fontSize: 16, color: c.accent, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "800", color: c.text, marginBottom: 24 },
  profileCard: { backgroundColor: c.card, borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, marginBottom: 24 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 22 },
  profileName: { fontSize: 17, fontWeight: "700", color: c.text },
  profileEmail: { fontSize: 13, color: c.textMuted, marginTop: 4 },
  editNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  editNameInput: { flex: 1, backgroundColor: c.input, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 15, color: c.text },
  saveNameBtn: { backgroundColor: c.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  saveNameBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: c.sectionTitle, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  card: { backgroundColor: c.card, borderRadius: 14, paddingHorizontal: 16, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  rowLabel: { fontSize: 15, color: c.text, fontWeight: "500" },
  rowSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  rowValue: { fontSize: 14, color: c.textMuted },
  testBtn: { backgroundColor: c.card, borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1.5, borderColor: c.accent, marginBottom: 12 },
  testBtnText: { color: c.accent, fontWeight: "700", fontSize: 15 },
  signOutBtn: { backgroundColor: c.card, borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1.5, borderColor: "#e74c3c", marginBottom: 12 },
  signOutText: { color: "#e74c3c", fontWeight: "700", fontSize: 15 },
  calBtn: { borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: c.accent },
  calBtnPrimary: { backgroundColor: c.accent },
  calBtnText: { color: c.accent, fontWeight: "700", fontSize: 14 },
  calBtnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  calHelp: { backgroundColor: c.input, borderRadius: 10, padding: 12 },
  calHelpTitle: { fontSize: 13, fontWeight: "700", color: c.text, marginBottom: 4 },
  calHelpText: { fontSize: 13, color: c.textSub, lineHeight: 20 },
  calPrivate: { fontSize: 12, color: c.textMuted, lineHeight: 17, marginTop: 2 },
  calReset: { fontSize: 13, color: "#e74c3c", fontWeight: "600" },
  testEmailLink: { fontSize: 13, color: c.accent, fontWeight: "700" },
  deleteLink: { alignItems: "center", paddingVertical: 10 },
  deleteLinkText: { color: c.textMuted, fontSize: 13, textDecorationLine: "underline" },
  deleteCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: "#e74c3c", marginTop: 4 },
  deleteTitle: { fontSize: 16, fontWeight: "800", color: "#e74c3c", marginBottom: 6 },
  deleteBody: { fontSize: 13, color: c.textSub, lineHeight: 19, marginBottom: 12 },
  deleteInput: { backgroundColor: c.input, borderRadius: 10, padding: 12, fontSize: 15, color: c.text, borderWidth: 1.5, borderColor: c.border, marginBottom: 12 },
  deleteBtnRow: { flexDirection: "row", gap: 10 },
  deleteCancelBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: c.border },
  deleteCancelText: { color: c.text, fontWeight: "700" },
  deleteConfirmBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: "#e74c3c" },
  deleteConfirmText: { color: "#fff", fontWeight: "700" },
  footer: { textAlign: "center", color: c.textMuted, fontSize: 12, marginTop: 20, marginBottom: 60 },
});

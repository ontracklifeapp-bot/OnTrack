import { router } from "expo-router";
import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useTheme } from "../utils/theme";

// Public landing page for website visitors who aren't signed in.

const FEATURES = [
  { icon: "✅", title: "Tasks that repeat", text: "Chores and to-dos that come back every week, month or year — automatically." },
  { icon: "💳", title: "Bills, sorted", text: "See what's due this month, what you've paid, and what's left. Never miss a payment." },
  { icon: "📚", title: "Homework by subject", text: "Color-coded subjects so you know exactly what's due for which class." },
  { icon: "🔔", title: "Reminders", text: "One-off or repeating — daily vitamins, weekly calls, yearly birthdays." },
  { icon: "📆", title: "Your calendar, synced", text: "Everything shows up in Google Calendar, Apple Calendar or Outlook." },
  { icon: "📧", title: "A 7am heads-up", text: "An optional morning email with what's overdue, due today and due tomorrow." },
  { icon: "⏰", title: "Snooze in one tap", text: "Not today? Push anything to tomorrow or next week without the guilt pile." },
  { icon: "🔒", title: "Private by design", text: "No ads, no tracking, and your data is never sold. Delete your account anytime." },
];

// A small, static preview built from the app's own card style
const PREVIEW = [
  { icon: "💳", name: "Electricity bill", badge: "Due today", badgeColor: "#e74c3c", badgeBg: "#fdecea", tag: "BILL", tagColor: "#e74c3c", extra: "$84.20 · Monthly" },
  { icon: "📚", name: "Biology lab report", badge: "Due tomorrow", badgeColor: "#e67e22", badgeBg: "#fff3e0", tag: "SCHOOL", tagColor: "#27ae60", extra: "Biology" },
  { icon: "🧹", name: "Clean the kitchen", badge: "Due in 3 days", badgeColor: "#e67e22", badgeBg: "#fff3e0", tag: "TASK", tagColor: "#6C63FF", extra: "every 1 week" },
  { icon: "💊", name: "Take vitamins", badge: "Due in 5 days", badgeColor: "#e67e22", badgeBg: "#fff3e0", tag: "REMINDER", tagColor: "#48C6EF", extra: "8:00 AM · Daily" },
];

export default function Welcome() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const s = styles(colors);

  const signUp = () => router.push("/login?mode=register");
  const signIn = () => router.push("/login");

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      {/* Top bar */}
      <View style={s.nav}>
        <View style={s.brand}>
          <Image source={require("../assets/images/icon.png")} style={s.logo} accessibilityIgnoresInvertColors />
          <Text style={s.brandText}>OnTrack</Text>
        </View>
        <TouchableOpacity onPress={signIn} style={s.navSignIn} accessibilityRole="link">
          <Text style={s.navSignInText}>Sign in</Text>
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <View style={[s.hero, wide && s.heroWide]}>
        <View style={[s.heroText, wide && { flex: 1 }]}>
          <Text style={[s.h1, wide && { fontSize: 48, lineHeight: 56 }]}>Stay on top of everything.</Text>
          <Text style={s.lead}>
            Tasks, bills, homework and reminders — all in one place, with a heads-up before anything is due.
          </Text>
          <TouchableOpacity style={s.cta} onPress={signUp} accessibilityRole="button">
            <Text style={s.ctaText}>Get started — it&apos;s free</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signIn} accessibilityRole="link">
            <Text style={s.secondary}>Already have an account? <Text style={{ color: colors.accent, fontWeight: "700" }}>Sign in</Text></Text>
          </TouchableOpacity>
        </View>

        {/* App preview */}
        <View style={[s.preview, wide && { flex: 1, maxWidth: 440 }]} accessibilityLabel="Preview of the OnTrack app">
          <Text style={s.previewGreeting}>Good morning 👋</Text>
          <Text style={s.previewSub}>4 items due this week</Text>
          {PREVIEW.map((p) => (
            <View key={p.name} style={[s.card, { borderLeftColor: p.tagColor }]}>
              <View style={[s.circle, { borderColor: p.tagColor }]}><Text style={{ fontSize: 16 }}>{p.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={s.cardTop}>
                  <Text style={s.cardName} numberOfLines={1}>{p.name}</Text>
                  <View style={[s.badge, { backgroundColor: p.badgeBg }]}><Text style={[s.badgeText, { color: p.badgeColor }]}>{p.badge}</Text></View>
                </View>
                <View style={s.cardBottom}>
                  <View style={[s.tag, { backgroundColor: p.tagColor + "22" }]}><Text style={[s.tagText, { color: p.tagColor }]}>{p.tag}</Text></View>
                  <Text style={s.cardExtra} numberOfLines={1}>{p.extra}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Features */}
      <Text style={s.h2}>Everything you need to stay on track</Text>
      <View style={s.grid}>
        {FEATURES.map((f) => (
          <View key={f.title} style={[s.feature, { width: wide ? "23.5%" : width >= 600 ? "48.5%" : "100%" }]}>
            <Text style={s.featureIcon}>{f.icon}</Text>
            <Text style={s.featureTitle}>{f.title}</Text>
            <Text style={s.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* Closing call to action */}
      <View style={s.bottomCta}>
        <Text style={[s.h2, { marginTop: 0 }]}>Ready to get on track?</Text>
        <Text style={[s.lead, { textAlign: "center" }]}>Free to use. Works on your phone and computer — add it to your home screen like an app.</Text>
        <TouchableOpacity style={[s.cta, { alignSelf: "center" }]} onPress={signUp} accessibilityRole="button">
          <Text style={s.ctaText}>Create your free account</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <TouchableOpacity onPress={() => router.push("/privacy")} accessibilityRole="link"><Text style={s.footerLink}>Privacy</Text></TouchableOpacity>
        <Text style={s.footerDot}>·</Text>
        <TouchableOpacity onPress={() => router.push("/terms")} accessibilityRole="link"><Text style={s.footerLink}>Terms</Text></TouchableOpacity>
        <Text style={s.footerDot}>·</Text>
        <TouchableOpacity onPress={() => Linking.openURL("mailto:ontrack.lifeapp@gmail.com")} accessibilityRole="link"><Text style={s.footerLink}>Contact</Text></TouchableOpacity>
      </View>
      <Text style={s.copyright}>© {new Date().getFullYear()} OnTrack</Text>
    </ScrollView>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.background },
  content: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 20, paddingBottom: 40 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 18 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 9 },
  brandText: { fontSize: 20, fontWeight: "800", color: c.text },
  navSignIn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: c.accent },
  navSignInText: { color: c.accent, fontWeight: "700", fontSize: 14 },
  hero: { gap: 28, marginTop: 20, marginBottom: 20 },
  heroWide: { flexDirection: "row", alignItems: "center", gap: 48, marginTop: 48, marginBottom: 40 },
  heroText: { gap: 16 },
  h1: { fontSize: 36, lineHeight: 42, fontWeight: "900", color: c.text },
  lead: { fontSize: 17, lineHeight: 25, color: c.textSub },
  cta: { backgroundColor: c.accent, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 28, alignItems: "center", alignSelf: "flex-start", marginTop: 6, shadowColor: c.accent, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  secondary: { fontSize: 14, color: c.textMuted },
  preview: { backgroundColor: c.card, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: c.border, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  previewGreeting: { fontSize: 20, fontWeight: "800", color: c.text },
  previewSub: { fontSize: 12, color: c.textMuted, marginBottom: 14, marginTop: 2 },
  card: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.background, borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 3 },
  circle: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardName: { flex: 1, fontSize: 14, fontWeight: "700", color: c.text },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  cardExtra: { fontSize: 11, color: c.textMuted, flex: 1 },
  h2: { fontSize: 26, fontWeight: "900", color: c.text, textAlign: "center", marginTop: 36, marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  feature: { backgroundColor: c.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.border },
  featureIcon: { fontSize: 26, marginBottom: 8 },
  featureTitle: { fontSize: 16, fontWeight: "800", color: c.text, marginBottom: 4 },
  featureText: { fontSize: 14, lineHeight: 20, color: c.textSub },
  bottomCta: { alignItems: "center", gap: 12, marginTop: 48, padding: 28, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 36 },
  footerLink: { color: c.textMuted, fontSize: 14, fontWeight: "600" },
  footerDot: { color: c.textMuted },
  copyright: { textAlign: "center", color: c.textMuted, fontSize: 12, marginTop: 10 },
});

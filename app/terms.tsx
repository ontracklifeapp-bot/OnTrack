import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { TOP_GAP } from "../constants/layout";
import { useTheme } from "../utils/theme";

const CONTACT_EMAIL = "ontrack.lifeapp@gmail.com";
const EFFECTIVE_DATE = "October 19, 2026";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Using OnTrack",
    body:
      "OnTrack is a free app for keeping track of tasks, bills, homework and reminders. " +
      "By creating an account you agree to these terms and to our Privacy Policy. You must be 13 or older to use OnTrack.",
  },
  {
    title: "Your account",
    body:
      "Keep your password private — you're responsible for what happens in your account. " +
      "Please give a real email address so we can send password resets and, if you turn them on, reminder emails.",
  },
  {
    title: "Your content",
    body:
      "What you add to OnTrack stays yours. We only store and use it to run the app for you, as described in the Privacy Policy. " +
      "You can delete your account and everything in it at any time from Settings.",
  },
  {
    title: "Fair use",
    body:
      "Please don't misuse OnTrack — for example by trying to access other people's data, overloading or attacking the service, " +
      "using it for anything illegal, or creating accounts automatically. We may suspend or close accounts that do.",
  },
  {
    title: "Reminders are a helping hand, not a guarantee",
    body:
      "OnTrack tries hard to remind you on time, but notifications, emails and calendar updates can be delayed or missed " +
      "(for example if your phone is off, an email lands in spam, or a calendar app refreshes late). " +
      "Please don't rely on OnTrack alone for anything critical, like important payments or deadlines.",
  },
  {
    title: "No warranty",
    body:
      "OnTrack is provided \"as is\", without warranties of any kind. To the extent the law allows, we aren't liable for " +
      "losses that come from using the app — including missed payments, late fees, or missed deadlines.",
  },
  {
    title: "Changes",
    body:
      "We may update OnTrack and these terms over time. If we make important changes we'll update the date at the top. " +
      "Continuing to use OnTrack after a change means you accept the updated terms.",
  },
];

export default function TermsScreen() {
  const { colors } = useTheme();
  const s = styles(colors);
  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <TouchableOpacity style={s.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.title}>Terms of Service</Text>
      <Text style={s.date}>Effective {EFFECTIVE_DATE}</Text>
      {SECTIONS.map((sec) => (
        <TextBlock key={sec.title} title={sec.title} body={sec.body} s={s} />
      ))}
      <TextBlock title="Contact" body={`Questions? Email ${CONTACT_EMAIL}.`} s={s} />
    </ScrollView>
  );
}

function TextBlock({ title, body, s }: { title: string; body: string; s: ReturnType<typeof styles> }) {
  return (
    <>
      <Text style={s.heading}>{title}</Text>
      <Text style={s.body}>{body}</Text>
    </>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 20 },
  backBtn: { marginTop: TOP_GAP, marginBottom: 8 },
  backText: { fontSize: 16, color: c.accent, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "800", color: c.text },
  date: { fontSize: 13, color: c.textMuted, marginTop: 4, marginBottom: 12 },
  heading: { fontSize: 16, fontWeight: "700", color: c.text, marginTop: 18, marginBottom: 6 },
  body: { fontSize: 14, color: c.textSub, lineHeight: 21, maxWidth: 720 },
});

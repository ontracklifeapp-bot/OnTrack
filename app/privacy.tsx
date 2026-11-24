import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../utils/theme";
import { TOP_GAP } from "../constants/layout";

const CONTACT_EMAIL = "ontrack.lifeapp@gmail.com";
const EFFECTIVE_DATE = "October 20, 2026";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "What we collect",
    body:
      "• Your email address and the name you enter, so you can sign in.\n" +
      "• The things you add to OnTrack: tasks, bills (names, amounts, due dates and payment history), homework, subjects, reminders and notes.\n" +
      "• If you import grades: your class names, term grades, assignments (names, due dates, scores), category weights and school year.\n" +
      "• A few settings: your time zone, which gradebook your school uses, and whether you want the daily email.\n" +
      "We don't collect your location, contacts, photos or payment details, and we don't use advertising or tracking tools.",
  },
  {
    title: "Grades and the OnTrack browser extension",
    body:
      "Grade import is optional. The OnTrack extension runs only when you click it, and only on your school's gradebook site " +
      "(for example Skyward), which you allow the first time. It reads the grades shown on your own gradebook pages — opening " +
      "your Grading, class assignment and Academic History pages in your tab to do so — and sends them to OnTrack in your browser.\n\n" +
      "OnTrack never asks for, sees or stores your school username or password: you sign in to your gradebook yourself. " +
      "The extension doesn't run in the background and doesn't read any other websites. It keeps only a small note on your " +
      "computer of which past years and quarters it has already imported. Your grades are visible only to you, and you can " +
      "remove a class (press and hold it) or delete everything with your account.",
  },
  {
    title: "How we use it",
    body:
      "Only to run OnTrack for you: to show your lists and grades, sync them between your devices, calculate averages, " +
      "and remind you about due dates. We never sell your data or share it with advertisers, and we never use your grades for anything else.",
  },
  {
    title: "Emails and calendar sync",
    body:
      "If you turn on the daily email summary, we use your email address to send you one email a day listing what's due; " +
      "turn it off any time in Settings. If you create a calendar link, anyone who has that private link can see your due dates, " +
      "so keep it private — you can reset it in Settings and the old link stops working.",
  },
  {
    title: "Where it's stored",
    body:
      "Your account and data are stored with Google Firebase. Each account can only read its own data. " +
      "Reminder notifications are scheduled on your own device. If the website hits an error, technical details " +
      "(the error, the page and your browser type — never your tasks, grades, name or email) are sent to our error-tracking service, Sentry, so we can fix it.",
  },
  {
    title: "Deleting your data",
    body:
      "You can delete your account at any time in Settings → Delete account. This permanently erases your account and everything you've added, including imported grades.",
  },
  {
    title: "Age",
    body: "OnTrack is intended for people aged 13 and older.",
  },
  {
    title: "Changes",
    body: "If this policy changes, we'll update it here and change the date at the top.",
  },
];

export default function PrivacyScreen() {
  const { colors } = useTheme();
  const s = styles(colors);
  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <TouchableOpacity style={s.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.title}>Privacy Policy</Text>
      <Text style={s.date}>Effective {EFFECTIVE_DATE}</Text>
      {SECTIONS.map((sec) => (
        <TextBlock key={sec.title} title={sec.title} body={sec.body} s={s} />
      ))}
      {!!CONTACT_EMAIL && <TextBlock title="Contact" body={`Questions? Email ${CONTACT_EMAIL}.`} s={s} />}
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

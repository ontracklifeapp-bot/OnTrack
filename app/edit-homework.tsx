import DateTimePicker from "../components/DateTimePicker";
import { useLocalSearchParams, router } from "expo-router";
import { getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { userDoc } from "../firebase/userCollection";
import { cancelNotification, scheduleNotification } from "../utils/notifications";
import { parseDate } from "../utils/dates";
import { useTheme } from "../utils/theme";
import { useToast } from "../utils/toast";
import { TOP_GAP } from "../constants/layout";

export default function EditHomework() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [taskName, setTaskName] = useState("");
  const [subject, setSubject] = useState("");
  const [subjectColor, setSubjectColor] = useState("#6C63FF");
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!id) return;
    getDoc(userDoc("homework", id)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setTaskName(d.taskName || "");
        setSubject(d.subject || "");
        setSubjectColor(d.subjectColor || "#6C63FF");
        setNotes(d.notes || "");
        const parsed = parseDate(d.dueDate);
        if (parsed) setDueDate(parsed);
      }
      setLoading(false);
    });
  }, [id]);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const handleSave = async () => {
    if (!taskName.trim()) { Alert.alert("Missing info", "Please enter an assignment name."); return; }
    if (!id) return;
    await updateDoc(userDoc("homework", id), { taskName, subject, subjectColor, dueDate: formatDate(dueDate), notes });
    await cancelNotification(id);
    const notifDate = new Date(dueDate);
    notifDate.setHours(9, 0, 0, 0);
    await scheduleNotification(id, "📚 Homework Due Today", `${taskName} – ${subject}`, notifDate);
    showToast("Assignment updated! ✓");
    setTimeout(() => router.back(), 600);
  };

  const { showToast, Toast } = useToast();
  const s = styles(colors);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <KeyboardAwareScrollView style={s.container} keyboardShouldPersistTaps="handled" extraScrollHeight={100} enableOnAndroid>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.title}>📚 Edit Homework</Text>

      <Text style={s.label}>Subject</Text>
      <TextInput
        style={[s.input, { borderLeftWidth: 4, borderLeftColor: subjectColor }]}
        placeholder="e.g. Math, Biology..."
        placeholderTextColor={colors.textMuted}
        value={subject}
        onChangeText={setSubject}
      />

      <Text style={s.label}>Assignment</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Chapter 5 questions..." onSubmitEditing={handleSave} returnKeyType="done"
        placeholderTextColor={colors.textMuted}
        value={taskName}
        onChangeText={setTaskName}
      />

      <Text style={s.label}>Due Date</Text>
      <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
        <Text style={s.dateBtnText}>📅 {formatDate(dueDate)}</Text>
      </TouchableOpacity>

      <Modal visible={showDatePicker} transparent animationType="fade" statusBarTranslucent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <DateTimePicker value={dueDate} mode="date" display={Platform.OS === "ios" ? "inline" : "default"} themeVariant="light" onChange={(_, selected) => { if (selected) setDueDate(selected); }} />
            <TouchableOpacity style={s.doneBtn} onPress={() => setShowDatePicker(false)}>
              <Text style={s.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Text style={s.label}>Notes (optional)</Text>
      <TextInput style={[s.input, { minHeight: 80, textAlignVertical: "top" }]} placeholder="Add any details or notes..." placeholderTextColor={colors.textMuted} value={notes} onChangeText={setNotes} multiline />

      <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
        <Text style={s.saveBtnText}>Save Changes</Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
    {Toast}
    </View>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.background },
  backBtn: { marginTop: TOP_GAP, marginBottom: 8 },
  backText: { fontSize: 16, color: c.accent, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "800", color: c.text, marginBottom: 28 },
  label: { fontSize: 13, fontWeight: "700", color: c.textSub, marginBottom: 10, marginTop: 18, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: c.input, borderRadius: 12, padding: 14, fontSize: 15, color: c.text },
  dateBtn: { backgroundColor: c.input, borderRadius: 12, padding: 14 },
  dateBtnText: { fontSize: 15, color: c.text },
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", borderRadius: 20, padding: 16, width: "90%" },
  doneBtn: { backgroundColor: c.accent, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 8 },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  saveBtn: { backgroundColor: c.accent, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 36, marginBottom: 60 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

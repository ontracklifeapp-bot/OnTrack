import DateTimePicker from "../components/DateTimePicker";
import { router } from "expo-router";
import { addDoc } from "firebase/firestore";
import { useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { userCol } from "../firebase/userCollection";
import { scheduleNotification } from "../utils/notifications";
import { useTheme } from "../utils/theme";
import { useToast } from "../utils/toast";
import { TOP_GAP } from "../constants/layout";
import EmojiPicker from "../components/EmojiPicker";

const ICONS = ["🏊", "🚗", "🧹", "💡", "🌿", "🔧", "🐾", "🏠", "💊", "🛁"];
const REPEAT_OPTIONS = ["1 week", "1 month", "3 months", "6 months", "1 year", "Custom"];

export default function AddTask() {
  const { colors } = useTheme();
  const { showToast, Toast } = useToast();
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("🏊");
  const [selectedRepeat, setSelectedRepeat] = useState("1 month");
  const [customRepeat, setCustomRepeat] = useState("");
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");

  const formatDate = (date: Date) => date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Ignore a second Save/Enter while the first one is still saving (prevents duplicates)
  const saving = useRef(false);
  const handleSave = async () => {
    if (saving.current) return;
    if (!name.trim()) { Alert.alert("Missing info", "Please enter a task name."); return; }
    const repeatValue = selectedRepeat === "Custom" ? customRepeat : selectedRepeat;
    saving.current = true;
    try {
      const docRef = await addDoc(userCol("tasks"), { name, icon: selectedIcon, repeat: repeatValue, dueDate: formatDate(dueDate), done: false, notes, createdAt: new Date() });
      const notifDate = new Date(dueDate);
      notifDate.setHours(9, 0, 0, 0);
      await scheduleNotification(docRef.id, `${selectedIcon} Task Due`, name, notifDate);
      showToast("Task saved! ✓");
      setTimeout(() => router.back(), 600);
    } catch {
      saving.current = false;
      Alert.alert("Error", "Could not save task. Try again.");
    }
  };

  const s = styles(colors);

  return (
    <View style={{ flex: 1 }}>
    <KeyboardAwareScrollView style={s.container} keyboardShouldPersistTaps="handled" extraScrollHeight={20}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.title}>Add Task</Text>

      <Text style={s.label}>TASK NAME</Text>
      <TextInput style={s.input} placeholder="e.g. Clean the pool" onSubmitEditing={handleSave} returnKeyType="done" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />

      <Text style={s.label}>ICON</Text>
      <EmojiPicker value={selectedIcon} onChange={setSelectedIcon} suggested={ICONS} />

      <Text style={s.label}>FIRST DUE DATE</Text>
      <TouchableOpacity style={s.dateField} onPress={() => setShowDatePicker(true)}>
        <Text style={s.dateText}>📅 {formatDate(dueDate)}</Text>
      </TouchableOpacity>

      <Modal visible={showDatePicker} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setShowDatePicker(false)} />
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Date</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <Text style={s.modalDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker value={dueDate} mode="date" display={Platform.OS === "ios" ? "inline" : "default"} themeVariant="light" onChange={(_, selectedDate) => { if (Platform.OS === "android") setShowDatePicker(false); if (selectedDate) setDueDate(selectedDate); }} style={{ backgroundColor: "#fff" }} />
        </View>
      </Modal>

      <Text style={s.label}>REPEATS EVERY</Text>
      <View style={s.repeatRow}>
        {REPEAT_OPTIONS.map((option) => (
          <TouchableOpacity key={option} style={[s.repeatChip, selectedRepeat === option && s.repeatChipActive]} onPress={() => setSelectedRepeat(option)}>
            <Text style={[s.repeatText, selectedRepeat === option && s.repeatTextActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedRepeat === "Custom" && (
        <TextInput style={[s.input, { marginBottom: 20 }]} placeholder="e.g. Every 3 weeks..." placeholderTextColor={colors.textMuted} value={customRepeat} onChangeText={setCustomRepeat} />
      )}

      <Text style={s.label}>NOTES (optional)</Text>
      <TextInput style={[s.input, { minHeight: 80, textAlignVertical: "top" }]} placeholder="Add any details or notes..." placeholderTextColor={colors.textMuted} value={notes} onChangeText={setNotes} multiline />

      <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
        <Text style={s.saveBtnText}>+ Save Task</Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
    {Toast}
    </View>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 20 },
  header: { marginTop: TOP_GAP, marginBottom: 8 },
  back: { color: c.accent, fontWeight: "600", fontSize: 15 },
  title: { fontSize: 28, fontWeight: "800", color: c.text, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: "700", color: c.sectionTitle, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: c.input, borderRadius: 12, padding: 14, marginBottom: 20, fontSize: 13, color: c.text },
  dateField: { backgroundColor: c.input, borderRadius: 12, padding: 14, marginBottom: 20 },
  dateText: { color: c.text, fontSize: 13, fontWeight: "600" },
  iconRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  iconChip: { backgroundColor: c.card, borderRadius: 12, padding: 10 },
  iconChipActive: { backgroundColor: c.accent },
  iconText: { fontSize: 22 },
  repeatRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  repeatChip: { backgroundColor: c.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  repeatChipActive: { backgroundColor: c.accent },
  repeatText: { fontSize: 12, fontWeight: "600", color: c.textSub },
  repeatTextActive: { color: "#fff" },
  saveBtn: { backgroundColor: c.accent, borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 40 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  modalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#222" },
  modalDone: { fontSize: 15, fontWeight: "700", color: c.accent },
});

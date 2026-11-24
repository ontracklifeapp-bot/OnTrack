import DateTimePicker from "../components/DateTimePicker";
import { router } from "expo-router";
import { addDoc } from "firebase/firestore";
import { useRef, useState } from "react";
import { Alert, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { userCol } from "../firebase/userCollection";
import { scheduleNotification } from "../utils/notifications";
import RepeatPicker, { toRepeatValue } from "../components/RepeatPicker";
import { useTheme } from "../utils/theme";
import { useToast } from "../utils/toast";
import { TOP_GAP } from "../constants/layout";
import EmojiPicker from "../components/EmojiPicker";

const ICONS = ["🔔", "👥", "💊", "🏃", "🛒", "📞", "✈️", "🎂", "💼", "🏠", "🎯", "⚡"];

export default function AddReminderScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("🔔");
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [repeat, setRepeat] = useState("Never");

  const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const formatTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  // Ignore a second Save/Enter while the first one is still saving (prevents duplicates)
  const saving = useRef(false);
  const handleSave = async () => {
    if (saving.current) return;
    if (!name.trim()) { Alert.alert("Missing info", "Please enter a reminder name."); return; }
    saving.current = true;
    try {
      const docRef = await addDoc(userCol("reminders"), {
        name, icon: selectedIcon, date: formatDate(date), time: formatTime(time), repeat: toRepeatValue(repeat), done: false, notes, createdAt: new Date(),
      });
      const notifDate = new Date(date);
      notifDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
      await scheduleNotification(docRef.id, `${selectedIcon} Reminder`, name, notifDate);
      showToast("Reminder saved! ✓");
      setTimeout(() => router.back(), 600);
    } catch { saving.current = false; Alert.alert("Error", "Could not save reminder. Try again."); }
  };

  const { showToast, Toast } = useToast();
  const s = styles(colors);

  return (
    <View style={{ flex: 1 }}>
    <KeyboardAwareScrollView style={s.container} keyboardShouldPersistTaps="handled" extraScrollHeight={100} enableOnAndroid>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.title}>🔔 Add Reminder</Text>

      <Text style={s.label}>{"What's the reminder?"}</Text>
      <TextInput style={s.input} placeholder="e.g. Meeting with friends, Call mom..." onSubmitEditing={handleSave} returnKeyType="done" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />

      <Text style={s.label}>Icon</Text>
      <EmojiPicker value={selectedIcon} onChange={setSelectedIcon} suggested={ICONS} />

      <Text style={s.label}>Date</Text>
      <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
        <Text style={s.dateBtnText}>📅 {formatDate(date)}</Text>
      </TouchableOpacity>

      <Text style={s.label}>Time</Text>
      <TouchableOpacity style={s.dateBtn} onPress={() => setShowTimePicker(true)}>
        <Text style={s.dateBtnText}>🕐 {formatTime(time)}</Text>
      </TouchableOpacity>

      <Modal visible={showDatePicker} transparent animationType="fade" statusBarTranslucent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <DateTimePicker value={date} mode="date" display={Platform.OS === "ios" ? "inline" : "default"} themeVariant="light" onChange={(_, selected) => { if (selected) setDate(selected); }} />
            <TouchableOpacity style={s.doneBtn} onPress={() => setShowDatePicker(false)}>
              <Text style={s.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showTimePicker} transparent animationType="fade" statusBarTranslucent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <DateTimePicker value={time} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"} themeVariant="light" onChange={(_, selected) => { if (selected) setTime(selected); }} />
            <TouchableOpacity style={s.doneBtn} onPress={() => setShowTimePicker(false)}>
              <Text style={s.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Text style={s.label}>Repeats</Text>
      <RepeatPicker value={repeat} onChange={setRepeat} />

      <Text style={s.label}>Notes (optional)</Text>
      <TextInput style={[s.input, { minHeight: 80, textAlignVertical: "top" }]} placeholder="Add any details or notes..." placeholderTextColor={colors.textMuted} value={notes} onChangeText={setNotes} multiline />

      <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
        <Text style={s.saveBtnText}>Save Reminder</Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
    {Toast}
    </View>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 20 },
  backBtn: { marginTop: TOP_GAP, marginBottom: 8 },
  backText: { fontSize: 16, color: c.accent, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "800", color: c.text, marginBottom: 28 },
  label: { fontSize: 13, fontWeight: "700", color: c.textSub, marginBottom: 10, marginTop: 18, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: c.input, borderRadius: 12, padding: 14, fontSize: 15, color: c.text, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  iconRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  iconChip: { backgroundColor: c.card, borderRadius: 12, padding: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  iconChipActive: { backgroundColor: c.accent },
  iconText: { fontSize: 22 },
  dateBtn: { backgroundColor: c.card, borderRadius: 12, padding: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  dateBtnText: { fontSize: 15, color: c.text },
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", borderRadius: 20, padding: 16, width: "90%" },
  doneBtn: { backgroundColor: c.accent, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 8 },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  saveBtn: { backgroundColor: c.accent, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 36, marginBottom: 60 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

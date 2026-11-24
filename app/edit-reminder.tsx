import DateTimePicker from "../components/DateTimePicker";
import { useLocalSearchParams, router } from "expo-router";
import { getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { userDoc } from "../firebase/userCollection";
import { cancelNotification, scheduleNotification } from "../utils/notifications";
import { parseDate } from "../utils/dates";
import RepeatPicker, { fromRepeatValue, toRepeatValue } from "../components/RepeatPicker";
import { useTheme } from "../utils/theme";
import { useToast } from "../utils/toast";
import { TOP_GAP } from "../constants/layout";
import EmojiPicker from "../components/EmojiPicker";

const ICONS = ["🔔", "👥", "💊", "🏃", "🛒", "📞", "✈️", "🎂", "💼", "🏠", "🎯", "⚡"];

export default function EditReminder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("🔔");
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [repeat, setRepeat] = useState("Never");

  useEffect(() => {
    if (!id) return;
    getDoc(userDoc("reminders", id)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setName(d.name || "");
        setSelectedIcon(d.icon || "🔔");
        setNotes(d.notes || "");
        setRepeat(fromRepeatValue(d.repeat));
        const parsedDate = parseDate(d.date);
        if (parsedDate) setDate(parsedDate);
        if (d.time) {
          const t = new Date();
          const match = d.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (match) {
            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const period = match[3].toUpperCase();
            if (period === "PM" && hours !== 12) hours += 12;
            if (period === "AM" && hours === 12) hours = 0;
            t.setHours(hours, minutes, 0, 0);
            setTime(t);
          }
        }
      }
      setLoading(false);
    });
  }, [id]);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("Missing info", "Please enter a reminder name."); return; }
    if (!id) return;
    await updateDoc(userDoc("reminders", id), { name, icon: selectedIcon, date: formatDate(date), time: formatTime(time), repeat: toRepeatValue(repeat), notes });
    await cancelNotification(id);
    const notifDate = new Date(date);
    notifDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
    await scheduleNotification(id, `${selectedIcon} Reminder`, name, notifDate);
    showToast("Reminder updated! ✓");
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
      <Text style={s.title}>🔔 Edit Reminder</Text>

      <Text style={s.label}>{"What's the reminder?"}</Text>
      <TextInput style={s.input} placeholder="e.g. Meeting with friends..." onSubmitEditing={handleSave} returnKeyType="done" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />

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
  iconRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  iconChip: { backgroundColor: c.card, borderRadius: 12, padding: 10 },
  iconChipActive: { backgroundColor: c.accent },
  iconText: { fontSize: 22 },
  dateBtn: { backgroundColor: c.card, borderRadius: 12, padding: 14 },
  dateBtnText: { fontSize: 15, color: c.text },
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", borderRadius: 20, padding: 16, width: "90%" },
  doneBtn: { backgroundColor: c.accent, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 8 },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  saveBtn: { backgroundColor: c.accent, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 36, marginBottom: 60 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

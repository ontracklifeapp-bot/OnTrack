import DateTimePicker from "../components/DateTimePicker";
import { useLocalSearchParams, router } from "expo-router";
import { getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { userCol, userDoc } from "../firebase/userCollection";
import { Payment } from "../utils/billPayments";
import { cancelNotification, scheduleNotification } from "../utils/notifications";
import { parseDate } from "../utils/dates";
import { useTheme } from "../utils/theme";
import { useToast } from "../utils/toast";
import { TOP_GAP } from "../constants/layout";

const REPEAT_OPTIONS = ["Monthly", "Yearly", "Weekly", "Quarterly", "One-time", "Custom"];

export default function EditBill() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedRepeat, setSelectedRepeat] = useState("Monthly");
  const [customRepeat, setCustomRepeat] = useState("");
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<Payment[]>([]);

  useEffect(() => {
    if (!id) return;
    getDoc(userDoc("bills", id)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setName(d.name || "");
        setAmount(d.amount?.toString() || "");
        setNotes(d.notes || "");
        const parsed = parseDate(d.dueDate);
        if (parsed) setDueDate(parsed);
        const repeat = d.repeat || "Monthly";
        if (REPEAT_OPTIONS.includes(repeat)) {
          setSelectedRepeat(repeat);
        } else {
          setSelectedRepeat("Custom");
          setCustomRepeat(repeat);
        }
      }
      setLoading(false);
    });
    getDocs(query(userCol("payments"), where("billId", "==", id)))
      .then((snap) => setHistory(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment).sort((a, b) => b.paidOn.localeCompare(a.paidOn))
      ))
      .catch(() => {});
  }, [id]);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("Missing info", "Please enter a bill name."); return; }
    if (!amount.trim() || isNaN(Number(amount))) { Alert.alert("Missing info", "Please enter a valid amount."); return; }
    if (selectedRepeat === "Custom" && !customRepeat.trim()) { Alert.alert("Missing info", "Please describe your custom repeat."); return; }
    if (!id) return;
    const repeatValue = selectedRepeat === "Custom" ? customRepeat : selectedRepeat;
    await updateDoc(userDoc("bills", id), { name, amount: parseFloat(amount), repeat: repeatValue, dueDate: formatDate(dueDate), notes });
    await cancelNotification(id);
    const notifDate = new Date(dueDate);
    notifDate.setHours(9, 0, 0, 0);
    await scheduleNotification(id, "💳 Bill Due Today", `${name} – $${parseFloat(amount).toFixed(2)}`, notifDate);
    showToast("Bill updated! ✓");
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
    <KeyboardAwareScrollView style={s.container} keyboardShouldPersistTaps="handled" extraScrollHeight={20}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.title}>Edit Bill</Text>

      <Text style={s.label}>Bill Name</Text>
      <TextInput style={s.input} placeholder="e.g. Netflix, Electricity" onSubmitEditing={handleSave} returnKeyType="done" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />

      <Text style={s.label}>Amount ($)</Text>
      <TextInput style={s.input} placeholder="e.g. 14.99" onSubmitEditing={handleSave} returnKeyType="done" placeholderTextColor={colors.textMuted} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

      <Text style={s.label}>Due Date</Text>
      <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
        <Text style={s.dateBtnText}>📅 {formatDate(dueDate)}</Text>
      </TouchableOpacity>

      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <DateTimePicker value={dueDate} mode="date" display={Platform.OS === "ios" ? "inline" : "default"} themeVariant="light" onChange={(_, selected) => { if (selected) setDueDate(selected); }} />
            <TouchableOpacity style={s.doneBtn} onPress={() => setShowDatePicker(false)}>
              <Text style={s.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Text style={s.label}>Repeat</Text>
      <View style={s.repeatGrid}>
        {REPEAT_OPTIONS.map((option) => (
          <TouchableOpacity key={option} style={[s.repeatChip, selectedRepeat === option && s.repeatChipActive]} onPress={() => setSelectedRepeat(option)}>
            <Text style={[s.repeatChipText, selectedRepeat === option && s.repeatChipTextActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedRepeat === "Custom" && (
        <TextInput style={[s.input, { marginTop: 12 }]} placeholder="e.g. Every 3 months..." placeholderTextColor={colors.textMuted} value={customRepeat} onChangeText={setCustomRepeat} />
      )}

      <Text style={s.label}>Notes (optional)</Text>
      <TextInput style={[s.input, { minHeight: 80, textAlignVertical: "top", marginTop: 8 }]} placeholder="Add any details or notes..." placeholderTextColor={colors.textMuted} value={notes} onChangeText={setNotes} multiline />

      <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
        <Text style={s.saveBtnText}>Save Changes</Text>
      </TouchableOpacity>

      {history.length > 0 && (
        <>
          <Text style={s.label}>Payment history</Text>
          <View style={s.historyCard}>
            {history.slice(0, 12).map((p, i) => (
              <View key={p.id} style={[s.historyRow, i > 0 && s.historyRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.historyDate}>
                    Paid {new Date(p.paidOn + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </Text>
                  <Text style={s.historySub}>for the {p.periodDue} bill</Text>
                </View>
                <Text style={s.historyAmount}>${(p.amount || 0).toFixed(2)}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: 40 }} />
        </>
      )}
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
  label: { fontSize: 13, fontWeight: "700", color: c.textSub, marginBottom: 8, marginTop: 18, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: c.input, borderRadius: 12, padding: 14, fontSize: 15, color: c.text },
  dateBtn: { backgroundColor: c.input, borderRadius: 12, padding: 14 },
  dateBtnText: { fontSize: 15, color: c.text },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", borderRadius: 20, padding: 16, width: "90%" },
  doneBtn: { backgroundColor: c.accent, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 8 },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  repeatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  repeatChip: { backgroundColor: c.card, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1.5, borderColor: c.border },
  repeatChipActive: { backgroundColor: c.accent, borderColor: c.accent },
  repeatChipText: { fontSize: 13, color: c.textSub, fontWeight: "600" },
  repeatChipTextActive: { color: "#fff" },
  saveBtn: { backgroundColor: c.accent, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 36, marginBottom: 60 },
  historyCard: { backgroundColor: c.card, borderRadius: 14, paddingHorizontal: 16 },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  historyRowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  historyDate: { fontSize: 14, fontWeight: "600", color: c.text },
  historySub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  historyAmount: { fontSize: 15, fontWeight: "800", color: "#27ae60" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

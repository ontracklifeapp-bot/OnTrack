import DateTimePicker from "../components/DateTimePicker";
import { router } from "expo-router";
import { addDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { userCol, userDoc } from "../firebase/userCollection";
import { scheduleNotification } from "../utils/notifications";
import { useTheme } from "../utils/theme";
import { useToast } from "../utils/toast";
import { TOP_GAP } from "../constants/layout";

const COLOR_PALETTE = [
  "#e74c3c","#c0392b","#e67e22","#d35400","#f1c40f","#f39c12",
  "#27ae60","#1e8449","#00BCD4","#0097A7","#2196F3","#1565C0",
  "#6C63FF","#4527A0","#e91e8c","#c2185b","#FF9800","#E65100",
  "#795548","#4E342E","#607D8B","#37474F","#aaaaaa","#222222",
];

export default function AddHomeworkScreen() {
  const { colors } = useTheme();
  const [taskName, setTaskName] = useState("");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState("#6C63FF");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(userCol("subjects"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSubjects(list);
      setSelectedSubject((prev: any) => prev ?? list[0] ?? null);
    });
    return unsubscribe;
  }, []);

  const formatDate = (date: Date) => date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const handleAddSubject = async () => {
    Keyboard.dismiss();
    if (!newSubjectName.trim()) { Alert.alert("Missing info", "Please enter a subject name."); return; }
    try {
      const ref = await addDoc(userCol("subjects"), { name: newSubjectName.trim(), color: newSubjectColor, createdAt: new Date() });
      setSelectedSubject({ id: ref.id, name: newSubjectName.trim(), color: newSubjectColor });
      setNewSubjectName("");
      setNewSubjectColor("#6C63FF");
      setShowSubjectModal(false);
    } catch { Alert.alert("Error", "Could not save subject."); }
  };

  const handleDeleteSubject = async (id: string) => {
    await deleteDoc(userDoc("subjects", id));
    if (selectedSubject?.id === id) setSelectedSubject(null);
  };

  // Ignore a second Save/Enter while the first one is still saving (prevents duplicates)
  const saving = useRef(false);
  const handleSave = async () => {
    if (saving.current) return;
    if (!taskName.trim()) { Alert.alert("Missing info", "Please enter an assignment name."); return; }
    if (!selectedSubject) { Alert.alert("Missing info", "Please select or create a subject."); return; }
    saving.current = true;
    try {
      const docRef = await addDoc(userCol("homework"), { subject: selectedSubject.name, subjectColor: selectedSubject.color, taskName, dueDate: formatDate(dueDate), done: false, notes, createdAt: new Date() });
      const notifDate = new Date(dueDate);
      notifDate.setHours(9, 0, 0, 0);
      await scheduleNotification(docRef.id, "📚 Homework Due Today", `${taskName} – ${selectedSubject.name}`, notifDate);
      showToast("Assignment saved! ✓");
      setTimeout(() => router.back(), 600);
    } catch { saving.current = false; Alert.alert("Error", "Could not save homework. Try again."); }
  };

  const { showToast, Toast } = useToast();
  const s = styles(colors);

  return (
    <View style={{ flex: 1 }}>
    <KeyboardAwareScrollView style={s.container} keyboardShouldPersistTaps="handled" extraScrollHeight={100} enableOnAndroid>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.title}>📚 Add Homework</Text>

      <Text style={s.label}>Subject</Text>
      <View style={s.subjectGrid}>
        {subjects.map((subject) => (
          <View key={subject.id} style={s.subjectWrapper}>
            <TouchableOpacity style={[s.subjectChip, selectedSubject?.id === subject.id && { backgroundColor: subject.color, borderColor: subject.color }]} onPress={() => setSelectedSubject(subject)}>
              <Text style={[s.subjectText, selectedSubject?.id === subject.id && { color: "#fff" }]}>{subject.name}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.deleteX, { backgroundColor: subject.color }]} onPress={() => handleDeleteSubject(subject.id)}>
              <Text style={s.deleteXText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={s.newSubjectChip} onPress={() => setShowSubjectModal(true)}>
          <Text style={s.newSubjectText}>＋ New</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.label}>Assignment</Text>
      <TextInput style={s.input} placeholder="e.g. Chapter 5 questions, Essay draft..." onSubmitEditing={handleSave} returnKeyType="done" placeholderTextColor={colors.textMuted} value={taskName} onChangeText={setTaskName} />

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

      <Modal visible={showSubjectModal} transparent animationType="fade" statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={s.modalTitle}>New Subject</Text>
                <TextInput style={s.input} placeholder="e.g. Math, Biology, Spanish..." placeholderTextColor={colors.textMuted} value={newSubjectName} onChangeText={setNewSubjectName} autoFocus />
                <Text style={[s.label, { marginTop: 16 }]}>Pick a color</Text>
                <View style={s.colorGrid}>
                  {COLOR_PALETTE.map((color) => (
                    <TouchableOpacity key={color} style={[s.colorSwatch, { backgroundColor: color }, newSubjectColor === color && s.colorSwatchActive]} onPress={() => setNewSubjectColor(color)} />
                  ))}
                </View>
                <View style={s.previewRow}>
                  <View style={[s.colorDot, { backgroundColor: newSubjectColor }]} />
                  <View style={[s.subjectChip, { backgroundColor: newSubjectColor, borderColor: newSubjectColor }]}>
                    <Text style={[s.subjectText, { color: "#fff" }]}>{newSubjectName || "Preview"}</Text>
                  </View>
                </View>
                <View style={s.modalBtns}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => { Keyboard.dismiss(); setShowSubjectModal(false); setNewSubjectName(""); setNewSubjectColor("#6C63FF"); }}>
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.doneBtn} onPress={handleAddSubject}>
                    <Text style={s.doneBtnText}>Add Subject</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {selectedSubject && (
        <>
          <Text style={s.label}>Preview</Text>
          <View style={[s.preview, { borderLeftColor: selectedSubject.color }]}>
            <Text style={[s.previewSubject, { color: selectedSubject.color }]}>{selectedSubject.name.toUpperCase()}</Text>
            <Text style={s.previewTask}>{taskName || "Your assignment name"}</Text>
            <Text style={s.previewDue}>Due {formatDate(dueDate)}</Text>
          </View>
        </>
      )}

      <Text style={s.label}>Notes (optional)</Text>
      <TextInput style={[s.input, { minHeight: 80, textAlignVertical: "top" }]} placeholder="Add any details or notes..." placeholderTextColor={colors.textMuted} value={notes} onChangeText={setNotes} multiline />

      <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
        <Text style={s.saveBtnText}>Save Homework</Text>
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
  subjectGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  subjectWrapper: { position: "relative" },
  subjectChip: { backgroundColor: c.card, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, paddingRight: 28, borderWidth: 1.5, borderColor: c.border },
  subjectText: { fontSize: 13, fontWeight: "600", color: c.textSub },
  deleteX: { position: "absolute", right: -6, top: -6, width: 18, height: 18, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  deleteXText: { color: "#fff", fontSize: 12, fontWeight: "800", lineHeight: 14 },
  newSubjectChip: { backgroundColor: c.background, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1.5, borderColor: c.accent, borderStyle: "dashed" },
  newSubjectText: { fontSize: 13, fontWeight: "700", color: c.accent },
  input: { backgroundColor: c.input, borderRadius: 12, padding: 14, fontSize: 15, color: c.text, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  dateBtn: { backgroundColor: c.input, borderRadius: 12, padding: 14 },
  dateBtnText: { fontSize: 15, color: c.text },
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "90%", maxHeight: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#222", marginBottom: 14 },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  colorSwatch: { width: 36, height: 36, borderRadius: 18 },
  colorSwatchActive: { borderWidth: 3, borderColor: "#222" },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "#e0e0e0" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 8 },
  cancelBtn: { flex: 1, backgroundColor: "#f0f0f0", borderRadius: 12, padding: 14, alignItems: "center" },
  cancelBtnText: { color: "#555", fontWeight: "700", fontSize: 14 },
  doneBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 12, padding: 14, alignItems: "center" },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  preview: { backgroundColor: c.card, borderRadius: 14, padding: 16, borderLeftWidth: 4, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  previewSubject: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  previewTask: { fontSize: 15, fontWeight: "700", color: c.text, marginBottom: 4 },
  previewDue: { fontSize: 12, color: c.textMuted },
  saveBtn: { backgroundColor: c.accent, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 36, marginBottom: 60 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

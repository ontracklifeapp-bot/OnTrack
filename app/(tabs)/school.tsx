import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Swipeable from "../../components/SwipeRow";
import { SnoozeButton, useSnooze } from "../../components/SnoozeSheet";
import SkeletonLoader from "../../components/SkeletonCard";
import { auth } from "../../firebase/firebase";
import { userCol, userDoc } from "../../firebase/userCollection";
import { updateItemNotification } from "../../utils/itemNotifications";
import { deleteWithUndo } from "../../utils/deleteWithUndo";
import { useTheme } from "../../utils/theme";
import { useToast } from "../../utils/toast";
import { getDaysUntil } from "../../utils/dates";
import { TOP_GAP } from "../../constants/layout";
import { pagerRoute } from "../../components/MobileTabPager";

export function School() {
  const { colors } = useTheme();
  const [homework, setHomework] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubSnap: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnap) unsubSnap();
      if (!user) { setHomework([]); return; }
      unsubSnap = onSnapshot(userCol("homework"), (snap) => {
        setHomework(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
    });
    return () => { unsubAuth(); if (unsubSnap) unsubSnap(); };
  }, []);

  const toggleDone = async (id: string, current: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateDoc(userDoc("homework", id), { done: !current });
    const item = homework.find((h) => h.id === id);
    if (item) await updateItemNotification("homework", item, !current);
  };

  const { showToast, Toast } = useToast();
  const { openSnooze, SnoozeSheet } = useSnooze(showToast);
  const handleDelete = (id: string) => {
    const item = homework.find((x) => x.id === id);
    if (item) deleteWithUndo("homework", item, showToast);
  };

  const [sortBy, setSortBy] = useState<"dueDate" | "name" | "subject">("dueDate");

  const sortItems = (items: any[]) => [...items].sort((a, b) => {
    if (sortBy === "name") return (a.taskName || "").localeCompare(b.taskName || "");
    if (sortBy === "subject") return (a.subject || "").localeCompare(b.subject || "");
    const da = getDaysUntil(a.dueDate), db = getDaysUntil(b.dueDate);
    if (isNaN(da) && isNaN(db)) return 0;
    if (isNaN(da)) return 1; if (isNaN(db)) return -1;
    return da - db;
  });

  const avatarInitial = (auth.currentUser?.displayName?.[0] ?? auth.currentUser?.email?.[0] ?? "?").toUpperCase();
  const overdue  = sortItems(homework.filter((h) => !h.done && getDaysUntil(h.dueDate) < 0));
  const upcoming = sortItems(homework.filter((h) => !h.done && getDaysUntil(h.dueDate) >= 0 && getDaysUntil(h.dueDate) <= 7));
  const later    = sortItems(homework.filter((h) => !h.done && (getDaysUntil(h.dueDate) > 7 || isNaN(getDaysUntil(h.dueDate)))));
  const done     = sortItems(homework.filter((h) => h.done));
  const s = styles(colors);

  const renderRightActions = (id: string) => (
    <View style={s.swipeActions}>
      <TouchableOpacity style={s.editAction} onPress={() => router.push(`/edit-homework?id=${id}`)}>
        <Text style={s.actionText}>✏️ Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.deleteAction} onPress={() => handleDelete(id)}>
        <Text style={s.actionText}>🗑️ Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCard = (item: any) => (
    <Swipeable
      key={item.id}
      renderRightActions={() => renderRightActions(item.id)}
      renderLeftActions={() => (
        <TouchableOpacity
          style={[s.completeAction, item.done && s.undoAction]}
          onPress={() => { toggleDone(item.id, item.done); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
        >
          <Text style={s.completeActionText}>{item.done ? "↩ Undo" : "✓ Done"}</Text>
        </TouchableOpacity>
      )}
    >
      <TouchableOpacity style={[s.card, { borderLeftColor: item.done ? "#27ae60" : (item.subjectColor || colors.accent) }]} activeOpacity={0.7} onPress={() => router.push(`/edit-homework?id=${item.id}`)} accessibilityLabel={`Edit ${item.taskName}`}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[s.subject, { color: item.done ? "#27ae60" : (item.subjectColor || colors.accent) }]}>
              {item.subject?.toUpperCase()}
            </Text>
            <Text style={[s.cardName, item.done && s.cardNameDone]}>{item.taskName}</Text>
            <Text style={s.cardDue}>Due {item.dueDate}</Text>
            {!!item.notes && <Text style={s.cardNotes} numberOfLines={2}>{item.notes}</Text>}
            {!item.done && getDaysUntil(item.dueDate) <= 1 && (
              <View style={s.snoozeRow}><SnoozeButton onPress={() => openSnooze("homework", item, item.taskName)} /></View>
            )}
          </View>
          <View style={item.done ? s.badgeDone : getDaysUntil(item.dueDate) < 0 ? s.badgeOverdue : s.badgePending}>
            <Text style={item.done ? s.badgeDoneText : getDaysUntil(item.dueDate) < 0 ? s.badgeOverdueText : s.badgePendingText}>
              {item.done ? "Done ✓" : getDaysUntil(item.dueDate) < 0 ? "Overdue" : "Pending"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 90 }}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>🎓 School</Text>
            <Text style={s.subtitle}>{overdue.length > 0 ? `${overdue.length} overdue` : `${upcoming.length + later.length} pending`}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel="Settings">
            <View style={s.avatar}><Text style={s.avatarText}>{avatarInitial}</Text></View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.gradesLink} onPress={() => router.push("/grades")} accessibilityRole="button">
          <Text style={s.gradesLinkText}>📊 My Grades</Text>
          <Text style={s.gradesLinkSub}>Averages, GPA & what you need on the final  ›</Text>
        </TouchableOpacity>

        <View style={s.sortRow}>
          {(["dueDate", "name", "subject"] as const).map((key) => (
            <TouchableOpacity key={key} style={[s.sortChip, sortBy === key && s.sortChipActive]} onPress={() => setSortBy(key)}>
              <Text style={[s.sortChipText, sortBy === key && s.sortChipTextActive]}>
                {key === "dueDate" ? "Due Date" : key === "name" ? "Name" : "Subject"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <SkeletonLoader count={3} />
        ) : homework.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>🎓</Text>
            <Text style={s.emptyTitle}>No assignments yet</Text>
            <Text style={s.emptySub}>Add your first one below</Text>
          </View>
        ) : (
          <>
            {overdue.length > 0 && (
              <>
                <Text style={[s.sectionTitle, s.sectionOverdue]}>🚨 Overdue</Text>
                {overdue.map(renderCard)}
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <Text style={s.sectionTitle}>📅 Upcoming</Text>
                {upcoming.map(renderCard)}
              </>
            )}
            {later.length > 0 && (
              <>
                <Text style={s.sectionTitle}>🕐 Later</Text>
                {later.map(renderCard)}
              </>
            )}
            {done.length > 0 && (
              <>
                <Text style={s.sectionTitle}>✅ Done</Text>
                {done.map(renderCard)}
              </>
            )}
          </>
        )}

        <TouchableOpacity style={s.addBtn} onPress={() => router.push("/add-homework")}>
          <Text style={s.addBtnText}>＋ Add Homework</Text>
        </TouchableOpacity>
      </ScrollView>
      {Toast}
      {SnoozeSheet}
    </GestureHandlerRootView>
  );
}

const styles = (c: ReturnType<typeof import("../../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: TOP_GAP, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: "800", color: c.text },
  subtitle: { fontSize: 13, color: c.textMuted, marginTop: 2 },
  gradesLink: { backgroundColor: c.card, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: c.accent },
  gradesLinkText: { fontSize: 16, fontWeight: "800", color: c.text },
  gradesLinkSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.accent, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: c.sectionTitle, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  sortRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  sortChip: { backgroundColor: c.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: c.border },
  sortChipActive: { backgroundColor: c.accent, borderColor: c.accent },
  sortChipText: { fontSize: 12, fontWeight: "600", color: c.textMuted },
  sortChipTextActive: { color: "#fff" },
  sectionOverdue: { color: "#e74c3c" },
  card: { backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 10, borderLeftWidth: 4, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  subject: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 },
  cardName: { fontSize: 13, fontWeight: "600", color: c.text, marginBottom: 2 },
  cardNameDone: { color: c.textMuted, textDecorationLine: "line-through" },
  cardDue: { fontSize: 11, color: c.textMuted },
  snoozeRow: { flexDirection: "row", marginTop: 6 },
  cardNotes: { fontSize: 11, color: c.textMuted, marginTop: 3, fontStyle: "italic" },
  badgePending: { backgroundColor: "#fff3e0", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgePendingText: { fontSize: 10, fontWeight: "700", color: "#e67e22" },
  badgeOverdue: { backgroundColor: "#fdecea", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOverdueText: { fontSize: 10, fontWeight: "700", color: "#e74c3c" },
  badgeDone: { backgroundColor: "#e8f5e9", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeDoneText: { fontSize: 10, fontWeight: "700", color: "#27ae60" },
  completeAction: { backgroundColor: "#27ae60", justifyContent: "center", alignItems: "center", width: 90, borderRadius: 14, marginBottom: 10, marginRight: 6 },
  undoAction: { backgroundColor: "#888" },
  completeActionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  swipeActions: { flexDirection: "row", marginBottom: 10 },
  editAction: { backgroundColor: c.accent, justifyContent: "center", alignItems: "center", width: 90, borderRadius: 14, marginRight: 6 },
  deleteAction: { backgroundColor: c.deleteAction, justifyContent: "center", alignItems: "center", width: 90, borderRadius: 14 },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  emptyState: { alignItems: "center", marginTop: 60, marginBottom: 20 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 6 },
  emptySub: { fontSize: 14, color: c.textMuted },
  addBtn: { backgroundColor: c.accent, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8, marginBottom: 40 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

// On the mobile website the page strip (MobileTabPager) shows this screen instead
export default pagerRoute(School);

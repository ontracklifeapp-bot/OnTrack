import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Swipeable from "../../components/SwipeRow";
import { SnoozeButton, useSnooze } from "../../components/SnoozeSheet";
import SkeletonLoader from "../../components/SkeletonCard";
import { auth } from "../../firebase/firebase";
import { userCol, userDoc } from "../../firebase/userCollection";
import { cancelNotification, scheduleNotification } from "../../utils/notifications";
import { updateItemNotification } from "../../utils/itemNotifications";
import { setBillPaid } from "../../utils/billPayments";
import { setReminderDone } from "../../utils/reminderActions";
import { deleteWithUndo } from "../../utils/deleteWithUndo";
import { useTheme } from "../../utils/theme";
import { useToast } from "../../utils/toast";
import { getDaysUntil, getNextDueDate, formatDate, repeatLabel } from "../../utils/dates";
import { TOP_GAP } from "../../constants/layout";
import { pagerRoute } from "../../components/MobileTabPager";
import VerifyEmailBanner from "../../components/VerifyEmailBanner";

// ── helpers ──────────────────────────────────────────────────────────────────

type BadgeInfo = { text: string; color: string; bg: string | null };

const getDueBadge = (dateStr: string): BadgeInfo => {
  const days = getDaysUntil(dateStr);
  if (isNaN(days)) return { text: dateStr || "No date", color: "#888", bg: null };

  const urgent = (text: string) => ({ text, color: "#e74c3c", bg: "#fdecea" });
  const warn   = (text: string) => ({ text, color: "#e67e22", bg: "#fff3e0" });
  const muted  = (text: string) => ({ text, color: "#888",    bg: null      });

  if (days < -1)   return urgent(`${Math.abs(days)} days overdue`);
  if (days === -1) return urgent("Due yesterday");
  if (days === 0)  return urgent("Due today");
  if (days === 1)  return warn("Due tomorrow");
  if (days < 7)    return warn(`Due in ${days} days`);
  if (days === 7)  return warn("Due in a week");
  if (days < 14)   return muted(`Due in ${days} days`);
  if (days === 14) return muted("Due in two weeks");
  if (days < 30)   return muted(`Due in ${Math.round(days / 7)} weeks`);
  if (days < 60)   return muted("Due in about a month");
  return muted(`Due in ${Math.round(days / 30)} months`);
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const KIND = { TASK: "task", BILL: "bill", SCHOOL: "homework", REMINDER: "reminder" } as const;

// ── component ─────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { showToast, Toast } = useToast();
  const { openSnooze, SnoozeSheet } = useSnooze(showToast);

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubs.forEach((fn) => fn());
      unsubs = [];
      if (!user) { setTasks([]); setBills([]); setHomework([]); setReminders([]); return; }
      let loaded = 0;
      const markLoaded = () => { if (++loaded >= 4) setLoading(false); };
      unsubs = [
        onSnapshot(userCol("tasks"),     (snap) => { setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); markLoaded(); }),
        onSnapshot(userCol("bills"),     (snap) => { setBills(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); markLoaded(); }),
        onSnapshot(userCol("homework"),  (snap) => { setHomework(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); markLoaded(); }),
        onSnapshot(userCol("reminders"), (snap) => { setReminders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); markLoaded(); }),
      ];
    });
    return () => { unsubAuth(); unsubs.forEach((fn) => fn()); };
  }, []);

  // ── mark-complete handlers ───────────────────────────────────────────────

  const fireHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  const completeTask = async (task: any) => {
    fireHaptic();
    if (!task.done && task.repeat && task.dueDate) {
      const next = getNextDueDate(task.dueDate, task.repeat);
      if (next) {
        const nextStr = formatDate(next);
        await updateDoc(userDoc("tasks", task.id), { done: false, dueDate: nextStr });
        await cancelNotification(task.id);
        const notifDate = new Date(next);
        notifDate.setHours(9, 0, 0, 0);
        await scheduleNotification(task.id, `${task.icon} Task Due`, task.name, notifDate);
        return;
      }
    }
    await updateDoc(userDoc("tasks", task.id), { done: !task.done });
    await updateItemNotification("task", task, !task.done);
  };

  const completeBill = async (bill: any) => {
    fireHaptic();
    await setBillPaid(bill, !bill.paid);
  };

  const completeHomework = async (hw: any) => {
    fireHaptic();
    await updateDoc(userDoc("homework", hw.id), { done: !hw.done });
    await updateItemNotification("homework", hw, !hw.done);
  };

  const completeReminder = async (r: any) => {
    fireHaptic();
    await setReminderDone(r, !r.done);
  };

  // ── derived state ────────────────────────────────────────────────────────

  const displayName = auth.currentUser?.displayName || auth.currentUser?.email || "there";
  const firstName   = displayName.split(" ")[0].split("@")[0];
  const avatarInitial = (auth.currentUser?.displayName?.[0] ?? auth.currentUser?.email?.[0] ?? "?").toUpperCase();

  const pendingTasks     = tasks.filter((t) => !t.done);
  const pendingBills     = bills.filter((b) => !b.paid);
  const pendingHomework  = homework.filter((h) => !h.done);
  const pendingReminders = reminders.filter((r) => !r.done);
  const unpaidTotal = pendingBills.reduce((sum, b) => sum + (b.amount || 0), 0);

  type ListItem = {
    id: string; name: string; date: string; category: string;
    icon: string; extra: string; accentColor: string;
    rawItem: any; onComplete: (item: any) => Promise<void>;
    editRoute: string; onDelete: () => void;
  };

  const allPending: ListItem[] = [
    ...pendingTasks.map((t) => ({
      id: t.id, name: t.name, date: t.dueDate, category: "TASK",
      icon: t.icon, extra: repeatLabel(t.repeat),
      accentColor: colors.accent, rawItem: t, onComplete: completeTask,
      editRoute: `/edit-task?id=${t.id}`,
      onDelete: () => deleteWithUndo("task", t, showToast),
    })),
    ...pendingBills.map((b) => ({
      id: b.id, name: b.name, date: b.dueDate, category: "BILL",
      icon: "💳", extra: `$${(b.amount || 0).toFixed(2)}`,
      accentColor: "#e74c3c", rawItem: b, onComplete: completeBill,
      editRoute: `/edit-bill?id=${b.id}`,
      onDelete: () => deleteWithUndo("bill", b, showToast),
    })),
    ...pendingHomework.map((h) => ({
      id: h.id, name: h.taskName, date: h.dueDate, category: "SCHOOL",
      icon: "📚", extra: h.subject || "",
      accentColor: h.subjectColor || colors.accent, rawItem: h, onComplete: completeHomework,
      editRoute: `/edit-homework?id=${h.id}`,
      onDelete: () => deleteWithUndo("homework", h, showToast),
    })),
    ...pendingReminders.map((r) => ({
      id: r.id, name: r.name, date: r.date, category: "REMINDER",
      icon: r.icon || "🔔", extra: [r.time, repeatLabel(r.repeat)].filter(Boolean).join(" · "),
      accentColor: "#48C6EF", rawItem: r, onComplete: completeReminder,
      editRoute: `/edit-reminder?id=${r.id}`,
      onDelete: () => deleteWithUndo("reminder", r, showToast),
    })),
  ].sort((a, b) => {
    const da = getDaysUntil(a.date);
    const db = getDaysUntil(b.date);
    if (isNaN(da) && isNaN(db)) return 0;
    if (isNaN(da)) return 1;
    if (isNaN(db)) return -1;
    return da - db;
  });

  const dueSoonCount = allPending.filter((i) => {
    const d = getDaysUntil(i.date);
    return !isNaN(d) && d <= 7;
  }).length;

  const filteredItems = search.trim()
    ? allPending.filter((i) => {
        const q = search.toLowerCase();
        return (
          i.name?.toLowerCase().includes(q) ||
          i.category?.toLowerCase().includes(q) ||
          i.extra?.toLowerCase().includes(q)
        );
      })
    : allPending;

  const overdueItems  = filteredItems.filter((i) => getDaysUntil(i.date) < 0);
  const upcomingItems = filteredItems.filter((i) => { const d = getDaysUntil(i.date); return d >= 0 && d <= 7; });
  const laterItems    = filteredItems.filter((i) => { const d = getDaysUntil(i.date); return d > 7 || isNaN(d); });

  const renderCard = (item: typeof allPending[0]) => {
    const badge = getDueBadge(item.date);
    return (
      <Swipeable
        key={`${item.category}-${item.id}`}
        renderLeftActions={() => (
          <TouchableOpacity
            style={s.completeAction}
            onPress={() => { item.onComplete(item.rawItem); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
          >
            <Text style={s.completeActionText}>✓ Done</Text>
          </TouchableOpacity>
        )}
        renderRightActions={() => (
          <View style={s.swipeActions}>
            <TouchableOpacity style={s.editAction} onPress={() => router.push(item.editRoute as any)}>
              <Text style={s.actionText}>✏️ Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.deleteAction}
              onPress={item.onDelete}
            >
              <Text style={s.actionText}>🗑️ Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      >
        <TouchableOpacity style={[s.card, { borderLeftWidth: 3, borderLeftColor: item.accentColor }]} activeOpacity={0.7} onPress={() => router.push(item.editRoute as any)} accessibilityLabel={`Edit ${item.name}`}>
          <View style={[s.circle, { borderColor: item.accentColor }]}>
            <Text style={s.circleIcon}>{item.icon}</Text>
          </View>
          <View style={s.cardInfo}>
            <View style={s.cardTopRow}>
              <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
              {badge.bg ? (
                <View style={[s.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[s.badgeText, { color: badge.color }]}>{badge.text}</Text>
                </View>
              ) : (
                <Text style={[s.badgePlain, { color: badge.color }]}>{badge.text}</Text>
              )}
            </View>
            <View style={s.cardBottomRow}>
              <View style={[s.categoryPill, { backgroundColor: item.accentColor + "22" }]}>
                <Text style={[s.categoryPillText, { color: item.accentColor }]}>{item.category}</Text>
              </View>
              {!!item.extra && <Text style={s.cardExtra} numberOfLines={1}>{item.extra}</Text>}
              {getDaysUntil(item.date) <= 1 && (
                <SnoozeButton onPress={() => openSnooze(KIND[item.category as keyof typeof KIND], item.rawItem, item.name)} />
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const s = styles(colors);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 90 }}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{getGreeting()}, {firstName} 👋</Text>
          <Text style={s.subtitle}>
            {overdueItems.length > 0
              ? `${overdueItems.length} overdue · ${upcomingItems.length} upcoming`
              : dueSoonCount > 0
              ? `${dueSoonCount} item${dueSoonCount !== 1 ? "s" : ""} due this week`
              : allPending.length > 0
              ? `${allPending.length} item${allPending.length !== 1 ? "s" : ""} on your plate`
              : "You're all caught up!"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel="Settings">
          <View style={s.avatar}><Text style={s.avatarText}>{avatarInitial}</Text></View>
        </TouchableOpacity>
      </View>

      {/* Stats chips */}
      <View style={s.statsRow}>
        <TouchableOpacity style={s.statChip} onPress={() => router.push("/(tabs)/tasks")} activeOpacity={0.7}>
          <Text style={[s.statValue, pendingTasks.length > 0 && { color: colors.accent }]}>
            {pendingTasks.length}
          </Text>
          <Text style={s.statLabel}>Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.statChip} onPress={() => router.push("/(tabs)/bills")} activeOpacity={0.7}>
          <Text style={[s.statValue, pendingBills.length > 0 && { color: "#e74c3c" }]}>
            ${unpaidTotal.toFixed(0)}
          </Text>
          <Text style={s.statLabel}>Unpaid</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.statChip} onPress={() => router.push("/(tabs)/school")} activeOpacity={0.7}>
          <Text style={[s.statValue, pendingHomework.length > 0 && { color: colors.accent }]}>
            {pendingHomework.length}
          </Text>
          <Text style={s.statLabel}>School</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.statChip} onPress={() => router.push("/(tabs)/reminders")} activeOpacity={0.7}>
          <Text style={[s.statValue, pendingReminders.length > 0 && { color: "#48C6EF" }]}>
            {pendingReminders.length}
          </Text>
          <Text style={s.statLabel}>Reminders</Text>
        </TouchableOpacity>
      </View>

      <VerifyEmailBanner />

      {/* Quick add */}
      <View style={s.quickRow}>
        {[
          { label: "Task", icon: "✅", route: "/add-task" },
          { label: "Bill", icon: "💳", route: "/add-bill" },
          { label: "Homework", icon: "📚", route: "/add-homework" },
          { label: "Reminder", icon: "🔔", route: "/add-reminder" },
        ].map((q) => (
          <TouchableOpacity
            key={q.label}
            style={s.quickChip}
            onPress={() => router.push(q.route as any)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${q.label.toLowerCase()}`}
          >
            <Text style={s.quickIcon}>{q.icon}</Text>
            <Text style={s.quickText} numberOfLines={1}>＋ {q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <TextInput
        style={s.searchInput}
        placeholder="Search tasks, bills, school..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        clearButtonMode="while-editing"
      />

      {/* Sections */}
      {loading ? (
        <SkeletonLoader count={4} />
      ) : allPending.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyEmoji}>🎉</Text>
          {tasks.length + bills.length + homework.length + reminders.length === 0 ? (
            <>
              <Text style={s.emptyTitle}>Welcome to OnTrack!</Text>
              <Text style={[s.emptySub, { textAlign: "center", lineHeight: 20 }]}>
                {"Add your first task, bill, homework or reminder with the buttons above.\nEverything due soon will show up right here."}
              </Text>
            </>
          ) : (
            <>
              <Text style={s.emptyTitle}>All caught up!</Text>
              <Text style={s.emptySub}>No tasks, bills, homework or reminders pending.</Text>
            </>
          )}
        </View>
      ) : search.trim() && filteredItems.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyEmoji}>🔍</Text>
          <Text style={s.emptyTitle}>No results</Text>
          <Text style={s.emptySub}>Try a different search term.</Text>
        </View>
      ) : (
        <>
          {overdueItems.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: "#e74c3c" }]}>🚨 Overdue</Text>
              {overdueItems.map((item) => renderCard(item))}
            </>
          )}
          {upcomingItems.length > 0 && (
            <>
              <Text style={s.sectionTitle}>📅 Upcoming</Text>
              {upcomingItems.map((item) => renderCard(item))}
            </>
          )}
          {laterItems.length > 0 && (
            <>
              <Text style={s.sectionTitle}>🕐 Later</Text>
              {laterItems.map((item) => renderCard(item))}
            </>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
    {Toast}
    {SnoozeSheet}
    </GestureHandlerRootView>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = (c: ReturnType<typeof import("../../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: TOP_GAP, marginBottom: 20 },
  greeting: { fontSize: 22, fontWeight: "800", color: c.text },
  subtitle: { fontSize: 13, color: c.textMuted, marginTop: 2 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.accent, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  // Four equal buttons in one row (icon above label), so they never wrap on phones
  quickRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  quickChip: { flex: 1, minWidth: 0, alignItems: "center", gap: 2, backgroundColor: c.card, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 4, borderWidth: 1.5, borderColor: c.border },
  quickIcon: { fontSize: 18 },
  quickText: { fontSize: 12, fontWeight: "700", color: c.accent },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statChip: {
    flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 12, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  statValue: { fontSize: 18, fontWeight: "800", color: c.textMuted },
  statLabel: { fontSize: 10, color: c.textMuted, marginTop: 2 },
  searchInput: {
    backgroundColor: c.card, borderRadius: 12, padding: 12, fontSize: 14, color: c.text,
    marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: c.sectionTitle, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  card: {
    backgroundColor: c.card, borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  circle: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 2,
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  circleIcon: { fontSize: 18 },
  cardInfo: { flex: 1 },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardName: { fontSize: 13, fontWeight: "600", color: c.text, flex: 1, marginRight: 8 },
  cardBottomRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  categoryPill: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  categoryPillText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  cardExtra: { fontSize: 11, color: c.textMuted, flex: 1 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  badgePlain: { fontSize: 11, fontWeight: "600" },
  completeAction: { backgroundColor: "#27ae60", justifyContent: "center", alignItems: "center", width: 90, borderRadius: 14, marginBottom: 10, marginRight: 6 },
  completeActionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  swipeActions: { flexDirection: "row", marginBottom: 10 },
  editAction: { backgroundColor: "#6C63FF", justifyContent: "center", alignItems: "center", width: 90, borderRadius: 14, marginRight: 6 },
  deleteAction: { backgroundColor: "#e74c3c", justifyContent: "center", alignItems: "center", width: 90, borderRadius: 14 },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  emptyState: { alignItems: "center", marginTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: c.text, marginBottom: 6 },
  emptySub: { fontSize: 14, color: c.textMuted },
});

// On the mobile website the page strip (MobileTabPager) shows this screen instead
export default pagerRoute(HomeScreen);

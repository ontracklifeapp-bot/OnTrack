import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Swipeable from "../../components/SwipeRow";
import { SnoozeButton, useSnooze } from "../../components/SnoozeSheet";
import SkeletonLoader from "../../components/SkeletonCard";
import { auth } from "../../firebase/firebase";
import { userCol } from "../../firebase/userCollection";
import { monthTotals, Payment, setBillPaid } from "../../utils/billPayments";
import { deleteWithUndo } from "../../utils/deleteWithUndo";
import { useTheme } from "../../utils/theme";
import { useToast } from "../../utils/toast";
import { getDaysUntil, repeatLabel } from "../../utils/dates";
import { TOP_GAP } from "../../constants/layout";
import { pagerRoute } from "../../components/MobileTabPager";

export function Bills() {
  const { colors } = useTheme();
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubs.forEach((u) => u());
      unsubs = [];
      if (!user) { setBills([]); setPayments([]); return; }
      unsubs.push(onSnapshot(userCol("bills"), (snap) => {
        setBills(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }));
      unsubs.push(onSnapshot(userCol("payments"), (snap) => {
        setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment));
      }));
    });
    return () => { unsubAuth(); unsubs.forEach((u) => u()); };
  }, []);

  const togglePaid = async (id: string, current: boolean) => {
    const bill = bills.find((b) => b.id === id);
    if (!bill) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setBillPaid(bill, !current);
  };

  const { showToast, Toast } = useToast();
  const { openSnooze, SnoozeSheet } = useSnooze(showToast);
  const handleDelete = (id: string) => {
    const item = bills.find((x) => x.id === id);
    if (item) deleteWithUndo("bill", item, showToast);
  };

  const { paid: paidAmt, remaining, total } = monthTotals(bills, payments);
  const avatarInitial = (auth.currentUser?.displayName?.[0] ?? auth.currentUser?.email?.[0] ?? "?").toUpperCase();
  const currentMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const [sortBy, setSortBy] = useState<"dueDate" | "amount" | "name">("dueDate");

  const sortItems = (items: any[]) => [...items].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "amount") return (b.amount || 0) - (a.amount || 0);
    const da = getDaysUntil(a.dueDate), db = getDaysUntil(b.dueDate);
    if (isNaN(da) && isNaN(db)) return 0;
    if (isNaN(da)) return 1; if (isNaN(db)) return -1;
    return da - db;
  });

  const overdue  = sortItems(bills.filter((b) => !b.paid && getDaysUntil(b.dueDate) < 0));
  const upcoming = sortItems(bills.filter((b) => !b.paid && getDaysUntil(b.dueDate) >= 0 && getDaysUntil(b.dueDate) <= 7));
  const later    = sortItems(bills.filter((b) => !b.paid && (getDaysUntil(b.dueDate) > 7 || isNaN(getDaysUntil(b.dueDate)))));
  const paid     = sortItems(bills.filter((b) => b.paid));
  const s = styles(colors);

  const renderBillCard = (bill: any) => (
    <Swipeable
      key={bill.id}
      renderRightActions={() => renderRightActions(bill.id)}
      renderLeftActions={() => (
        <TouchableOpacity
          style={[s.completeAction, bill.paid && s.undoAction]}
          onPress={() => { togglePaid(bill.id, bill.paid); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
        >
          <Text style={s.completeActionText}>{bill.paid ? "↩ Undo" : "✓ Paid"}</Text>
        </TouchableOpacity>
      )}
    >
      <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={() => router.push(`/edit-bill?id=${bill.id}`)} accessibilityLabel={`Edit ${bill.name}`}>
        <Text style={s.cardIcon}>💳</Text>
        <View style={s.cardInfo}>
          <Text style={[s.cardName, bill.paid && s.cardNameDone]}>{bill.name}</Text>
          <Text style={s.cardDue}>Due {bill.dueDate}{repeatLabel(bill.repeat) ? ` · ${repeatLabel(bill.repeat)}` : ""}</Text>
          {!!bill.notes && <Text style={s.cardNotes} numberOfLines={2}>{bill.notes}</Text>}
          {!bill.paid && getDaysUntil(bill.dueDate) <= 1 && (
            <View style={s.snoozeRow}><SnoozeButton onPress={() => openSnooze("bill", bill, bill.name)} /></View>
          )}
        </View>
        <View style={s.cardRight}>
          <Text style={[s.amount, bill.paid && { color: "#27ae60" }]}>${bill.amount?.toFixed(2)}</Text>
          <View style={bill.paid ? s.badgePaid : getDaysUntil(bill.dueDate) < 0 ? s.badgeOverdue : s.badgeSoon}>
            <Text style={bill.paid ? s.badgePaidText : getDaysUntil(bill.dueDate) < 0 ? s.badgeOverdueText : s.badgeSoonText}>
              {bill.paid ? "Paid ✓" : getDaysUntil(bill.dueDate) < 0 ? "Overdue" : "Upcoming"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  const renderRightActions = (id: string) => (
    <View style={s.swipeActions}>
      <TouchableOpacity style={s.editAction} onPress={() => router.push(`/edit-bill?id=${id}`)}>
        <Text style={s.actionText}>✏️ Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.deleteAction} onPress={() => handleDelete(id)}>
        <Text style={s.actionText}>🗑️ Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 90 }}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>💳 Bills</Text>
            <Text style={s.subtitle}>{currentMonth}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel="Settings">
            <View style={s.avatar}><Text style={s.avatarText}>{avatarInitial}</Text></View>
          </TouchableOpacity>
        </View>

        <LinearGradient colors={["#6C63FF", "#48C6EF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.totalCard}>
          <Text style={s.totalLabel}>This month</Text>
          <Text style={s.totalAmount}>${total.toFixed(2)}</Text>
          <Text style={s.totalSub}>${paidAmt.toFixed(2)} paid · ${remaining.toFixed(2)} left to pay</Text>
        </LinearGradient>

        <View style={s.sortRow}>
          {(["dueDate", "amount", "name"] as const).map((key) => (
            <TouchableOpacity key={key} style={[s.sortChip, sortBy === key && s.sortChipActive]} onPress={() => setSortBy(key)}>
              <Text style={[s.sortChipText, sortBy === key && s.sortChipTextActive]}>
                {key === "dueDate" ? "Due Date" : key === "amount" ? "Amount ↓" : "Name"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <SkeletonLoader count={3} />
        ) : bills.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>💳</Text>
            <Text style={s.emptyTitle}>No bills yet</Text>
            <Text style={s.emptySub}>Add your first bill below</Text>
          </View>
        ) : (
          <>
            {overdue.length > 0 && (
              <>
                <Text style={[s.sectionTitle, s.sectionOverdue]}>🚨 Overdue</Text>
                {overdue.map((bill) => renderBillCard(bill))}
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <Text style={s.sectionTitle}>📅 Upcoming</Text>
                {upcoming.map((bill) => renderBillCard(bill))}
              </>
            )}
            {later.length > 0 && (
              <>
                <Text style={s.sectionTitle}>🕐 Later</Text>
                {later.map((bill) => renderBillCard(bill))}
              </>
            )}
            {paid.length > 0 && (
              <>
                <Text style={s.sectionTitle}>✅ Paid</Text>
                {paid.map((bill) => renderBillCard(bill))}
              </>
            )}
          </>
        )}

        <TouchableOpacity style={s.addBtn} onPress={() => router.push("/add-bill")}>
          <Text style={s.addBtnText}>＋ Add Bill</Text>
        </TouchableOpacity>
      </ScrollView>
      {Toast}
      {SnoozeSheet}
    </GestureHandlerRootView>
  );
}

const styles = (c: ReturnType<typeof import("../../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: TOP_GAP, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "800", color: c.text },
  subtitle: { fontSize: 13, color: c.textMuted, marginTop: 2 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.accent, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  totalCard: { borderRadius: 16, padding: 20, marginBottom: 20 },
  totalLabel: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 4 },
  totalAmount: { fontSize: 34, fontWeight: "800", color: "#fff", marginBottom: 4 },
  totalSub: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: c.sectionTitle, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  sortRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  sortChip: { backgroundColor: c.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: c.border },
  sortChipActive: { backgroundColor: c.accent, borderColor: c.accent },
  sortChipText: { fontSize: 12, fontWeight: "600", color: c.textMuted },
  sortChipTextActive: { color: "#fff" },
  sectionOverdue: { color: "#e74c3c" },
  card: { backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardIcon: { fontSize: 22, width: 36 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 13, fontWeight: "600", color: c.text },
  cardNameDone: { color: c.textMuted, textDecorationLine: "line-through" },
  cardDue: { fontSize: 11, color: c.textMuted, marginTop: 2 },
  snoozeRow: { flexDirection: "row", marginTop: 6 },
  cardNotes: { fontSize: 11, color: c.textMuted, marginTop: 3, fontStyle: "italic" },
  cardRight: { alignItems: "flex-end", gap: 4 },
  amount: { fontSize: 14, fontWeight: "700", color: "#e74c3c" },
  badgeSoon: { backgroundColor: "#fff3e0", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeSoonText: { fontSize: 10, fontWeight: "700", color: "#e67e22" },
  badgeOverdue: { backgroundColor: "#fdecea", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOverdueText: { fontSize: 10, fontWeight: "700", color: "#e74c3c" },
  badgePaid: { backgroundColor: "#e8f5e9", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgePaidText: { fontSize: 10, fontWeight: "700", color: "#27ae60" },
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
export default pagerRoute(Bills);

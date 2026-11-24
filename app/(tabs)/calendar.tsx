import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { auth } from "../../firebase/firebase";
import { userCol } from "../../firebase/userCollection";
import { advanceDate, getDaysUntil, parseDate, parseRepeat, repeatLabel, toLocalISO } from "../../utils/dates";
import { useTheme } from "../../utils/theme";
import { TOP_GAP } from "../../constants/layout";
import { pagerRoute } from "../../components/MobileTabPager";

const parseToISO = (dateStr: string): string | null => {
  const d = parseDate(dateStr);
  return d ? toLocalISO(d) : null;
};

// Returns local ISO date strings for the current due date + all occurrences within 1 year
const getOccurrences = (dueDateStr: string, repeat?: string): string[] => {
  const start = parseDate(dueDateStr);
  if (!start) return [];
  const results: string[] = [toLocalISO(start)];
  const rep = parseRepeat(repeat);
  if (!rep) return results;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() + 1);
  let d = start;
  for (let i = 0; i < 400; i++) {
    d = advanceDate(d, rep);
    if (d > cutoff) break;
    results.push(toLocalISO(d));
  }
  return results;
};

// Category colors
const CAT = {
  task:     { color: "#22c55e", label: "Task"     },
  bill:     { color: "#e74c3c", label: "Bill"     },
  school:   { color: "#6C63FF", label: "School"   },
  reminder: { color: "#48C6EF", label: "Reminder" },
};

export function CalendarScreen() {
  const { colors } = useTheme();
  const todayISO = toLocalISO(new Date());
  const [tasks,     setTasks]     = useState<any[]>([]);
  const [bills,     setBills]     = useState<any[]>([]);
  const [homework,  setHomework]  = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [selected,     setSelected]     = useState(todayISO);
  const [displayMonth, setDisplayMonth] = useState(todayISO);
  const [showPicker,   setShowPicker]   = useState(false);
  const [pickerYear,   setPickerYear]   = useState(new Date().getFullYear());
  const [pickerMonth,  setPickerMonth]  = useState(new Date().getMonth());

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubs.forEach((fn) => fn());
      unsubs = [];
      if (!user) { setTasks([]); setBills([]); setHomework([]); setReminders([]); return; }
      unsubs = [
        onSnapshot(userCol("tasks"),     (s) => setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
        onSnapshot(userCol("bills"),     (s) => setBills(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
        onSnapshot(userCol("homework"),  (s) => setHomework(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
        onSnapshot(userCol("reminders"), (s) => setReminders(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      ];
    });
    return () => { unsubAuth(); unsubs.forEach((fn) => fn()); };
  }, []);

  // Build marked dates map — including all future occurrences of recurring items
  const markedDates: Record<string, any> = {};

  const addDots = (isoList: string[], key: keyof typeof CAT) => {
    isoList.forEach((iso) => {
      if (!markedDates[iso]) markedDates[iso] = { dots: [] };
      const existing = markedDates[iso].dots as any[];
      if (!existing.find((d: any) => d.key === key)) {
        existing.push({ key, color: CAT[key].color });
      }
    });
  };

  tasks.filter((t) => !t.done && t.dueDate).forEach((t) =>
    addDots(getOccurrences(t.dueDate, t.repeat), "task")
  );
  bills.filter((b) => !b.paid && b.dueDate).forEach((b) =>
    addDots(getOccurrences(b.dueDate, b.repeat), "bill")
  );
  homework.filter((h) => !h.done && h.dueDate).forEach((h) =>
    addDots(getOccurrences(h.dueDate), "school")
  );
  reminders.filter((r) => !r.done && r.date).forEach((r) =>
    addDots(getOccurrences(r.date, r.repeat), "reminder")
  );

  // Highlight selected date
  markedDates[selected] = {
    ...(markedDates[selected] || {}),
    selected: true,
    selectedColor: colors.accent,
    dots: markedDates[selected]?.dots || [],
  };

  // Items for selected day — check all occurrences of recurring items
  const dayItems = [
    ...tasks.filter((t) => !t.done && t.dueDate && getOccurrences(t.dueDate, t.repeat).includes(selected)).map((t) => ({
      id: `task-${t.id}-${selected}`, name: t.name, icon: t.icon || "✅",
      sub: repeatLabel(t.repeat) ? `repeats ${repeatLabel(t.repeat)}` : "", cat: "task" as const,
    })),
    ...bills.filter((b) => !b.paid && b.dueDate && getOccurrences(b.dueDate, b.repeat).includes(selected)).map((b) => ({
      id: `bill-${b.id}-${selected}`, name: b.name, icon: "💳",
      sub: `$${(b.amount || 0).toFixed(2)}${repeatLabel(b.repeat) ? ` · ${repeatLabel(b.repeat)}` : ""}`, cat: "bill" as const,
    })),
    ...homework.filter((h) => !h.done && parseToISO(h.dueDate) === selected).map((h) => ({
      id: `hw-${h.id}`, name: h.taskName, icon: "📚", sub: h.subject || "", cat: "school" as const,
    })),
    ...reminders.filter((r) => !r.done && r.date && getOccurrences(r.date, r.repeat).includes(selected)).map((r) => ({
      id: `rem-${r.id}-${selected}`, name: r.name, icon: r.icon || "🔔", sub: [r.time, repeatLabel(r.repeat)].filter(Boolean).join(" · "), cat: "reminder" as const,
    })),
  ];

  // Everything still to do, by its next due date — shown under the calendar
  type Upcoming = { key: string; iso: string; days: number; name: string; icon: string; sub: string; cat: keyof typeof CAT };
  const upcoming: Upcoming[] = [
    ...tasks.filter((t) => !t.done).map((t) => ({ key: `task-${t.id}`, date: t.dueDate, name: t.name, icon: t.icon || "✅", sub: repeatLabel(t.repeat), cat: "task" as const })),
    ...bills.filter((b) => !b.paid).map((b) => ({ key: `bill-${b.id}`, date: b.dueDate, name: b.name, icon: "💳", sub: `$${(b.amount || 0).toFixed(2)}${repeatLabel(b.repeat) ? ` · ${repeatLabel(b.repeat)}` : ""}`, cat: "bill" as const })),
    ...homework.filter((h) => !h.done).map((h) => ({ key: `hw-${h.id}`, date: h.dueDate, name: h.taskName, icon: "📚", sub: h.subject || "", cat: "school" as const })),
    ...reminders.filter((r) => !r.done).map((r) => ({ key: `rem-${r.id}`, date: r.date, name: r.name, icon: r.icon || "🔔", sub: [r.time, repeatLabel(r.repeat)].filter(Boolean).join(" · "), cat: "reminder" as const })),
  ]
    .map(({ date, ...rest }) => ({ ...rest, iso: parseToISO(date) ?? "", days: getDaysUntil(date) }))
    .filter((i) => i.iso && !isNaN(i.days))
    .sort((a, b) => a.iso.localeCompare(b.iso));

  const overdueItems = upcoming.filter((i) => i.days < 0);
  const futureGroups: { iso: string; days: number; items: Upcoming[] }[] = [];
  upcoming.filter((i) => i.days >= 0).forEach((i) => {
    const last = futureGroups[futureGroups.length - 1];
    if (last && last.iso === i.iso) last.items.push(i);
    else futureGroups.push({ iso: i.iso, days: i.days, items: [i] });
  });

  const dayLabel = (iso: string, days: number) => {
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    const d = new Date(iso + "T00:00:00");
    const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString("en-US", opts) + (days < 7 ? "" : ` · in ${days} days`);
  };

  // Tapping an upcoming item jumps the calendar to that day
  const scrollRef = useRef<ScrollView>(null);
  const jumpTo = (iso: string) => {
    setSelected(iso);
    setDisplayMonth(iso);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const renderUpcoming = (i: Upcoming, showDays?: boolean) => (
    <TouchableOpacity key={i.key} style={[s.card, { borderLeftColor: CAT[i.cat].color }]} onPress={() => jumpTo(i.iso)} activeOpacity={0.7}>
      <Text style={s.cardIcon}>{i.icon}</Text>
      <View style={s.cardInfo}>
        <Text style={s.cardName}>{i.name}</Text>
        {!!(i.sub || showDays) && (
          <Text style={s.cardSub}>
            {[showDays ? `${Math.abs(i.days)} day${Math.abs(i.days) !== 1 ? "s" : ""} overdue` : "", i.sub].filter(Boolean).join(" · ")}
          </Text>
        )}
      </View>
      <View style={[s.catPill, { backgroundColor: CAT[i.cat].color + "22" }]}>
        <Text style={[s.catPillText, { color: CAT[i.cat].color }]}>{CAT[i.cat].label.toUpperCase()}</Text>
      </View>
    </TouchableOpacity>
  );

  const avatarInitial = (auth.currentUser?.displayName?.[0] ?? auth.currentUser?.email?.[0] ?? "?").toUpperCase();
  const s = styles(colors);

  const formatSelectedLabel = () => {
    const d = new Date(selected + "T00:00:00");
    if (selected === todayISO) return "Today";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <ScrollView ref={scrollRef} style={s.container} stickyHeaderIndices={[0]}>
      {/* Header */}
      <View style={s.headerWrap}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>📅 Calendar</Text>
            <Text style={s.subtitle}>{"Tap a date to see what's due"}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel="Settings">
            <View style={s.avatar}><Text style={s.avatarText}>{avatarInitial}</Text></View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Calendar */}
      <Calendar
        initialDate={displayMonth}
        onDayPress={(day: any) => setSelected(day.dateString)}
        onMonthChange={(month: any) => setDisplayMonth(month.dateString)}
        markedDates={markedDates}
        markingType="multi-dot"
        // The library's built-in arrow images turn invisible on web (tint filter), so draw our own
        renderArrow={(direction: "left" | "right") => (
          <Text style={[s.calArrow, { color: colors.accent }]}>{direction === "left" ? "‹" : "›"}</Text>
        )}
        renderHeader={(date: any) => {
          // The library passes a UTC "XDate"; read its year/month as-is. Converting it to a local
          // Date showed the previous month for the 1st (e.g. March 1 → "February").
          const ym = String(date?.toString?.("yyyy-MM") ?? "");
          const [y, m] = /^\d{4}-\d{2}$/.test(ym) ? ym.split("-").map(Number) : displayMonth.split("-").map(Number);
          const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
          return (
            <TouchableOpacity
              onPress={() => {
                setPickerYear(y);
                setPickerMonth(m - 1);
                setShowPicker(true);
              }}
              style={s.calHeaderBtn}
            >
              <Text style={[s.calHeaderText, { color: colors.text }]}>{label}</Text>
              <Text style={[s.calHeaderChevron, { color: colors.accent }]}>▾</Text>
            </TouchableOpacity>
          );
        }}
        theme={{
          backgroundColor: colors.background,
          calendarBackground: colors.card,
          textSectionTitleColor: colors.textMuted,
          selectedDayBackgroundColor: colors.accent,
          selectedDayTextColor: "#fff",
          todayTextColor: colors.accent,
          dayTextColor: colors.text,
          textDisabledColor: colors.textMuted,
          arrowColor: colors.accent,
          monthTextColor: colors.text,
          textDayFontWeight: "600",
          textMonthFontWeight: "800",
          textDayHeaderFontWeight: "700",
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 12,
        }}
        style={s.calendar}
      />

      {/* Month / Year Picker Modal */}
      <Modal visible={showPicker} transparent animationType="fade" statusBarTranslucent>
        <View style={s.pickerOverlay}>
          <View style={[s.pickerBox, { backgroundColor: colors.card }]}>

            {/* Year row */}
            <View style={s.yearRow}>
              <TouchableOpacity onPress={() => setPickerYear((y) => y - 1)} style={s.yearArrow}>
                <Text style={[s.yearArrowText, { color: colors.accent }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[s.yearText, { color: colors.text }]}>{pickerYear}</Text>
              <TouchableOpacity onPress={() => setPickerYear((y) => y + 1)} style={s.yearArrow}>
                <Text style={[s.yearArrowText, { color: colors.accent }]}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Month grid */}
            <View style={s.monthGrid}>
              {MONTHS.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    s.monthChip,
                    { backgroundColor: pickerMonth === i ? colors.accent : colors.background },
                  ]}
                  onPress={() => setPickerMonth(i)}
                >
                  <Text style={[s.monthChipText, { color: pickerMonth === i ? "#fff" : colors.text }]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Actions */}
            <View style={s.pickerActions}>
              <TouchableOpacity style={[s.pickerBtn, { backgroundColor: colors.background }]} onPress={() => setShowPicker(false)}>
                <Text style={[s.pickerBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.pickerBtn, { backgroundColor: colors.accent }]}
                onPress={() => {
                  const month = String(pickerMonth + 1).padStart(2, "0");
                  setDisplayMonth(`${pickerYear}-${month}-01`);
                  setShowPicker(false);
                }}
              >
                <Text style={[s.pickerBtnText, { color: "#fff" }]}>Go</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Legend */}
      <View style={s.legend}>
        {Object.entries(CAT).map(([key, { color, label }]) => (
          <View key={key} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: color }]} />
            <Text style={s.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Day detail */}
      <Text style={s.sectionTitle}>
        {formatSelectedLabel()} · {dayItems.length} item{dayItems.length !== 1 ? "s" : ""}
      </Text>

      {dayItems.length === 0 ? (
        <View style={s.emptyDay}>
          <Text style={s.emptyDayText}>Nothing due — enjoy the break!</Text>
        </View>
      ) : (
        dayItems.map((item) => (
          <View key={`${item.cat}-${item.id}`} style={[s.card, { borderLeftColor: CAT[item.cat].color }]}>
            <Text style={s.cardIcon}>{item.icon}</Text>
            <View style={s.cardInfo}>
              <Text style={s.cardName}>{item.name}</Text>
              {!!item.sub && <Text style={s.cardSub}>{item.sub}</Text>}
            </View>
            <View style={[s.catPill, { backgroundColor: CAT[item.cat].color + "22" }]}>
              <Text style={[s.catPillText, { color: CAT[item.cat].color }]}>{CAT[item.cat].label.toUpperCase()}</Text>
            </View>
          </View>
        ))
      )}

      {/* Everything coming up */}
      {overdueItems.length > 0 && (
        <>
          <Text style={[s.sectionTitle, s.listTitle, { color: "#e74c3c" }]}>🚨 Overdue · {overdueItems.length}</Text>
          {overdueItems.map((i) => renderUpcoming(i, true))}
        </>
      )}
      <Text style={[s.sectionTitle, s.listTitle]}>📋 Upcoming · {upcoming.length - overdueItems.length}</Text>
      {futureGroups.length === 0 ? (
        <View style={s.emptyDay}>
          <Text style={s.emptyDayText}>Nothing coming up.</Text>
        </View>
      ) : (
        futureGroups.map((g) => (
          <View key={g.iso}>
            <Text style={s.groupLabel}>{dayLabel(g.iso, g.days)}</Text>
            {g.items.map((i) => renderUpcoming(i))}
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = (c: ReturnType<typeof import("../../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background },
  headerWrap:  { backgroundColor: c.background, paddingHorizontal: 20, paddingTop: TOP_GAP, paddingBottom: 8 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title:       { fontSize: 24, fontWeight: "800", color: c.text },
  subtitle:    { fontSize: 13, color: c.textMuted, marginTop: 2 },
  avatar:      { width: 42, height: 42, borderRadius: 21, backgroundColor: c.accent, justifyContent: "center", alignItems: "center" },
  avatarText:  { color: "#fff", fontWeight: "800", fontSize: 18 },
  calendar:        { marginHorizontal: 20, borderRadius: 16, overflow: "hidden", marginTop: 8 },
  calArrow: { fontSize: 28, fontWeight: "700", lineHeight: 30, paddingHorizontal: 6 },
  calHeaderBtn:    { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  calHeaderText:   { fontSize: 16, fontWeight: "800" },
  calHeaderChevron: { fontSize: 13, fontWeight: "700" },
  pickerOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
  pickerBox:       { width: "85%", borderRadius: 20, padding: 20, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  yearRow:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  yearArrow:       { padding: 8 },
  yearArrowText:   { fontSize: 28, fontWeight: "300", lineHeight: 30 },
  yearText:        { fontSize: 22, fontWeight: "800" },
  monthGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 20 },
  monthChip:       { width: "28%", paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  monthChipText:   { fontSize: 13, fontWeight: "700" },
  pickerActions:   { flexDirection: "row", gap: 10 },
  pickerBtn:       { flex: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  pickerBtnText:   { fontSize: 14, fontWeight: "700" },
  legend:      { flexDirection: "row", justifyContent: "center", gap: 16, paddingVertical: 12, paddingHorizontal: 20 },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendText:  { fontSize: 11, color: c.textMuted, fontWeight: "600" },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: c.sectionTitle, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginHorizontal: 20, marginTop: 4 },
  listTitle:   { marginTop: 20 },
  groupLabel:  { fontSize: 12, fontWeight: "700", color: c.textSub, marginHorizontal: 20, marginBottom: 6, marginTop: 6 },
  emptyDay:    { alignItems: "center", paddingVertical: 28, marginHorizontal: 20 },
  emptyDayText: { fontSize: 14, color: c.textMuted },
  card:        { backgroundColor: c.card, borderRadius: 14, padding: 14, marginBottom: 10, marginHorizontal: 20, flexDirection: "row", alignItems: "center", borderLeftWidth: 3, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardIcon:    { fontSize: 20, width: 32 },
  cardInfo:    { flex: 1 },
  cardName:    { fontSize: 13, fontWeight: "600", color: c.text },
  cardSub:     { fontSize: 11, color: c.textMuted, marginTop: 2 },
  catPill:     { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  catPillText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
});

// On the mobile website the page strip (MobileTabPager) shows this screen instead
export default pagerRoute(CalendarScreen);

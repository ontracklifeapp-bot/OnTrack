import { onAuthStateChanged } from "firebase/auth";
import { onSnapshot } from "firebase/firestore";
import { router, Tabs, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { MobileTabPager, PagerModeProvider } from "../../components/MobileTabPager";
import { auth } from "../../firebase/firebase";
import { userCol } from "../../firebase/userCollection";
import { getDaysUntil } from "../../utils/dates";
import { useTheme } from "../../utils/theme";
import { Bills } from "./bills";
import { CalendarScreen } from "./calendar";
import { HomeScreen } from "./index";
import { Reminders } from "./reminders";
import { School } from "./school";
import { TasksScreen } from "./tasks";

function countOverdue(items: any[], dateKey: string, doneKey: string) {
  return items.filter((i) => !i[doneKey] && getDaysUntil(i[dateKey]) < 0).length;
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={bs.badge}>
      <Text style={bs.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}
const bs = StyleSheet.create({
  badge: { position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#e74c3c", justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});

function TabIcon({ emoji, badge }: { emoji: string; badge?: number }) {
  return (
    <View>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      {!!badge && <Badge count={badge} />}
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  // Wide screens (desktop browsers, tablets) get a sidebar instead of a bottom bar
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const pathname = usePathname();
  const onCalendar = pathname === "/calendar";

  // Website on phones: show the tabs as a swipeable page strip (MobileTabPager). Not on wide
  // screens (sidebar) nor in the phone app (where sideways swipes open card actions).
  const pagerMode = Platform.OS === "web" && !wide;
  const [overdue, setOverdue] = useState({ tasks: 0, bills: 0, school: 0, reminders: 0 });

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubs.forEach((u) => u());
      unsubs.length = 0;
      if (!user) { setOverdue({ tasks: 0, bills: 0, school: 0, reminders: 0 }); return; }

      unsubs.push(onSnapshot(userCol("tasks"), (s) => {
        const items = s.docs.map((d) => d.data());
        setOverdue((prev) => ({ ...prev, tasks: countOverdue(items, "dueDate", "done") }));
      }));
      unsubs.push(onSnapshot(userCol("bills"), (s) => {
        const items = s.docs.map((d) => d.data());
        setOverdue((prev) => ({ ...prev, bills: countOverdue(items, "dueDate", "paid") }));
      }));
      unsubs.push(onSnapshot(userCol("homework"), (s) => {
        const items = s.docs.map((d) => d.data());
        setOverdue((prev) => ({ ...prev, school: countOverdue(items, "dueDate", "done") }));
      }));
      unsubs.push(onSnapshot(userCol("reminders"), (s) => {
        const items = s.docs.map((d) => d.data());
        setOverdue((prev) => ({ ...prev, reminders: countOverdue(items, "date", "done") }));
      }));
    });
    return () => { unsubAuth(); unsubs.forEach((u) => u()); };
  }, []);

  const totalOverdue = overdue.tasks + overdue.bills + overdue.school + overdue.reminders;

  const calendarButton = (bottom: number) => !onCalendar && (
    <TouchableOpacity
      style={[s.fab, { backgroundColor: colors.accent, bottom }, wide && { bottom: 28, right: 28 }]}
      onPress={() => router.push("/(tabs)/calendar")}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Open calendar"
    >
      <View style={s.calIcon}>
        <View style={s.calTop} />
        <Text style={s.calDay}>{new Date().getDate()}</Text>
      </View>
    </TouchableOpacity>
  );

  const tabs = (
      <Tabs
        tabBar={pagerMode ? () => null : undefined}
        screenOptions={{
          headerShown: false,
          // Sidebar: highlight the current tab with a solid accent pill and white text
          // (the library's default highlight is bright blue, which made purple text unreadable)
          tabBarActiveTintColor: wide ? "#fff" : colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarActiveBackgroundColor: wide ? colors.accent : "transparent",
          tabBarInactiveBackgroundColor: "transparent",
          tabBarPosition: wide ? "left" : "bottom",
          tabBarLabelPosition: wide ? "beside-icon" : "below-icon",
          tabBarStyle: wide
            ? { backgroundColor: colors.tabBar, borderRightColor: colors.border, width: 220, paddingTop: 24 }
            : {
                backgroundColor: colors.tabBar,
                borderTopColor: colors.border,
                height: 80,
                paddingBottom: 16,
                paddingTop: 8,
              },
          tabBarItemStyle: wide ? { justifyContent: "flex-start", paddingHorizontal: 16, maxHeight: 52 } : undefined,
          tabBarLabelStyle: {
            fontSize: wide ? 15 : width < 400 ? 10 : 11, // 10 on phones so "Reminders" fits
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: () => <TabIcon emoji="🏠" badge={totalOverdue} />,
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: "Tasks",
            tabBarIcon: () => <TabIcon emoji="✅" badge={overdue.tasks} />,
          }}
        />
        <Tabs.Screen
          name="bills"
          options={{
            title: "Bills",
            tabBarIcon: () => <TabIcon emoji="💳" badge={overdue.bills} />,
          }}
        />
        <Tabs.Screen
          name="school"
          options={{
            title: "School",
            tabBarIcon: () => <TabIcon emoji="🎓" badge={overdue.school} />,
          }}
        />
        <Tabs.Screen
          name="reminders"
          options={{
            title: "Reminders",
            tabBarIcon: () => <TabIcon emoji="🔔" badge={overdue.reminders} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: "Calendar",
            tabBarIcon: () => <TabIcon emoji="📅" />,
          }}
        />
        {/* Computers only: Grades in the sidebar. Phones reach it from School. */}
        <Tabs.Screen
          name="my-grades"
          options={{
            title: "Grades",
            href: wide ? "/my-grades" : null,
            // Pinned to the bottom corner of the sidebar, apart from the other tabs
            tabBarItemStyle: { justifyContent: "flex-start", paddingHorizontal: 16, maxHeight: 52, marginTop: "auto", marginBottom: 20 },
            tabBarIcon: () => <TabIcon emoji="📊" />,
          }}
        />
      </Tabs>
  );

  if (pagerMode) {
    return (
      <PagerModeProvider value>
        {/* The navigator stays mounted (it owns the URL) but its screens render nothing here */}
        <View style={{ display: "none" }}>{tabs}</View>
        <MobileTabPager
          overlay={calendarButton(16)}
          tabs={[
            { path: "/", title: "Home", emoji: "🏠", badge: totalOverdue, Screen: HomeScreen },
            { path: "/tasks", title: "Tasks", emoji: "✅", badge: overdue.tasks, Screen: TasksScreen },
            { path: "/bills", title: "Bills", emoji: "💳", badge: overdue.bills, Screen: Bills },
            { path: "/school", title: "School", emoji: "🎓", badge: overdue.school, Screen: School },
            { path: "/reminders", title: "Reminders", emoji: "🔔", badge: overdue.reminders, Screen: Reminders },
            { path: "/calendar", title: "Calendar", emoji: "📅", Screen: CalendarScreen },
          ]}
        />
      </PagerModeProvider>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {tabs}
      {/* Floating Calendar Button (hidden on the calendar itself, where it would cover items) */}
      {calendarButton(96)}
    </View>
  );
}

const s = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 96,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  calIcon: {
    width: 28, height: 28, backgroundColor: "#fff",
    borderRadius: 6, overflow: "hidden",
    alignItems: "center",
  },
  calTop: {
    width: "100%", height: 8, backgroundColor: "#e74c3c",
  },
  calDay: {
    fontSize: 13, fontWeight: "800", color: "#222", marginTop: 1,
  },
});

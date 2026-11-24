import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

type SlideType = "intro" | "swipe-right" | "swipe-left" | "sections" | "ready";

const SLIDES: { key: string; title: string; subtitle: string; bg: string; type: SlideType; emoji?: string }[] = [
  {
    key: "1",
    emoji: "👋",
    title: "Welcome to OnTrack",
    subtitle: "Your all-in-one personal life manager. Stay on top of everything that matters.",
    bg: "#6C63FF",
    type: "intro",
  },
  {
    key: "2",
    title: "Swipe Right to Complete",
    subtitle: "Swipe any card to the right to instantly mark it as done. Works for tasks, bills, homework, and reminders.",
    bg: "#27ae60",
    type: "swipe-right",
  },
  {
    key: "3",
    title: "Swipe Left to Edit or Delete",
    subtitle: "Swipe a card to the left to reveal Edit and Delete options for quick changes.",
    bg: "#6C63FF",
    type: "swipe-left",
  },
  {
    key: "4",
    title: "Sections & Sorting",
    subtitle: "Cards are grouped into Overdue, Upcoming, and Later. Tap the sort chips to reorder by date, name, or amount.",
    bg: "#e67e22",
    type: "sections",
  },
  {
    key: "5",
    emoji: "🚀",
    title: "You're All Set!",
    subtitle: "Create an account and start managing your life — tasks, bills, school, and reminders all in one place.",
    bg: "#48C6EF",
    type: "ready",
  },
];


function SwipeRightDemo() {
  return (
    <View style={m.demoWrap}>
      {/* The green action revealed behind */}
      <View style={m.swipeRightBg}>
        <Text style={m.swipeActionText}>✓ Done</Text>
      </View>
      {/* Card shifted right to reveal green */}
      <View style={[m.card, { transform: [{ translateX: 72 }] }]}>
        <View style={m.cardCircle} />
        <View style={m.cardText}>
          <View style={m.cardLine} />
          <View style={[m.cardLine, { width: "55%", opacity: 0.5 }]} />
        </View>
        <View style={m.cardBadgePending}><Text style={m.cardBadgePendingText}>Pending</Text></View>
      </View>
      {/* Arrow + label */}
      <View style={m.gestureRow}>
        <Text style={m.arrowText}>→</Text>
        <Text style={m.gestureLabel}>swipe right</Text>
      </View>
    </View>
  );
}

function SwipeLeftDemo() {
  return (
    <View style={m.demoWrap}>
      {/* Card shifted left to reveal actions */}
      <View style={[m.card, { transform: [{ translateX: -90 }] }]}>
        <View style={m.cardCircle} />
        <View style={m.cardText}>
          <View style={m.cardLine} />
          <View style={[m.cardLine, { width: "55%", opacity: 0.5 }]} />
        </View>
        <View style={m.cardBadgePending}><Text style={m.cardBadgePendingText}>Pending</Text></View>
      </View>
      {/* Edit + Delete revealed on the right */}
      <View style={m.swipeLeftActions}>
        <View style={m.editBtn}><Text style={m.swipeActionText}>✏️ Edit</Text></View>
        <View style={m.deleteBtn}><Text style={m.swipeActionText}>🗑️ Del</Text></View>
      </View>
      {/* Arrow + label */}
      <View style={m.gestureRow}>
        <Text style={m.gestureLabel}>swipe left</Text>
        <Text style={m.arrowText}>←</Text>
      </View>
    </View>
  );
}

function SectionsDemo() {
  return (
    <View style={m.sectionsWrap}>
      {/* Section headers */}
      <View style={m.sectionRow}>
        <Text style={m.sectionOverdue}>🚨 OVERDUE</Text>
        <View style={m.sectionCard}><View style={[m.cardLine, { backgroundColor: "#fdecea" }]} /></View>
      </View>
      <View style={m.sectionRow}>
        <Text style={m.sectionUpcoming}>📅 UPCOMING</Text>
        <View style={m.sectionCard}><View style={[m.cardLine, { backgroundColor: "rgba(255,255,255,0.3)" }]} /></View>
      </View>
      <View style={m.sectionRow}>
        <Text style={m.sectionLater}>🕐 LATER</Text>
        <View style={m.sectionCard}><View style={[m.cardLine, { backgroundColor: "rgba(255,255,255,0.2)" }]} /></View>
      </View>
      {/* Sort chips */}
      <View style={m.chipsRow}>
        <View style={m.chipActive}><Text style={m.chipActiveText}>Due Date</Text></View>
        <View style={m.chip}><Text style={m.chipText}>Name</Text></View>
        <View style={m.chip}><Text style={m.chipText}>Added</Text></View>
      </View>
    </View>
  );
}

// ─── Slide renderer ──────────────────────────────────────────────────────────

function SlideContent({ slide }: { slide: typeof SLIDES[0] }) {
  if (slide.type === "swipe-right") {
    return (
      <View style={s.slideInner}>
        <Text style={s.slideTitle}>{slide.title}</Text>
        <SwipeRightDemo />
        <Text style={s.slideSubtitle}>{slide.subtitle}</Text>
      </View>
    );
  }
  if (slide.type === "swipe-left") {
    return (
      <View style={s.slideInner}>
        <Text style={s.slideTitle}>{slide.title}</Text>
        <SwipeLeftDemo />
        <Text style={s.slideSubtitle}>{slide.subtitle}</Text>
      </View>
    );
  }
  if (slide.type === "sections") {
    return (
      <View style={s.slideInner}>
        <Text style={s.slideTitle}>{slide.title}</Text>
        <SectionsDemo />
        <Text style={s.slideSubtitle}>{slide.subtitle}</Text>
      </View>
    );
  }
  // intro / ready
  return (
    <View style={s.slideInner}>
      <View style={s.emojiCircle}>
        <Text style={s.emoji}>{slide.emoji}</Text>
      </View>
      <Text style={s.slideTitle}>{slide.title}</Text>
      <Text style={s.slideSubtitle}>{slide.subtitle}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      finish();
    }
  };

  const handleSkip = () => finish();

  const finish = async () => {
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    router.replace("/login");
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={s.container}>
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={[s.slide, { backgroundColor: item.bg, width }]}>
            <SlideContent slide={item} />
          </View>
        )}
      />

      {/* Dot indicators */}
      <View style={[s.dotsRow, { backgroundColor: SLIDES[currentIndex].bg }]}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: "clamp" });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: "clamp" });
          return <Animated.View key={i} style={[s.dot, { width: dotWidth, opacity }]} />;
        })}
      </View>

      {/* Navigation buttons */}
      <View style={[s.btnRow, { backgroundColor: SLIDES[currentIndex].bg }]}>
        {!isLast ? (
          <TouchableOpacity onPress={handleSkip} style={s.skipBtn}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <TouchableOpacity onPress={handleNext} style={s.nextBtn}>
          <Text style={s.nextText}>{isLast ? "Get Started" : "Next →"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  slide: { flex: 1, justifyContent: "center", alignItems: "center" },
  slideInner: { alignItems: "center", paddingHorizontal: 32, paddingBottom: 100, width: "100%" },
  emojiCircle: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center", marginBottom: 32,
  },
  emoji: { fontSize: 60 },
  slideTitle: { fontSize: 26, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 16 },
  slideSubtitle: { fontSize: 15, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 22, marginTop: 24 },
  dotsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingBottom: 8 },
  dot: { height: 8, borderRadius: 4, backgroundColor: "#fff" },
  btnRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 28, paddingBottom: 52, paddingTop: 16,
  },
  skipBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  skipText: { color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "600" },
  nextBtn: {
    backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 30,
    paddingVertical: 14, paddingHorizontal: 28,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)",
  },
  nextText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

// Mock card styles
const m = StyleSheet.create({
  // ─── Swipe demos ──────────────────────────────────────────────────────────
  demoWrap: {
    width: "100%", marginTop: 8, alignItems: "flex-start", overflow: "hidden",
    borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", padding: 16,
  },

  // Swipe right: green bg revealed on the left
  swipeRightBg: {
    position: "absolute", left: 16, top: 16, bottom: 16,
    width: 90, backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 12, justifyContent: "center", alignItems: "center",
  },

  // Swipe left: edit + delete on the right
  swipeLeftActions: {
    position: "absolute", right: 16, top: 16, bottom: 16,
    flexDirection: "row", gap: 6,
  },
  editBtn: {
    width: 72, backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 12, justifyContent: "center", alignItems: "center",
  },
  deleteBtn: {
    width: 72, backgroundColor: "rgba(220,53,69,0.5)",
    borderRadius: 12, justifyContent: "center", alignItems: "center",
  },
  swipeActionText: { color: "#fff", fontWeight: "700", fontSize: 12, textAlign: "center" },

  // Card mockup
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12,
    padding: 14, gap: 10,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#e0e0e0", flexShrink: 0,
  },
  cardText: { flex: 1, gap: 6 },
  cardLine: { height: 10, backgroundColor: "#e0e0e0", borderRadius: 5 },
  cardBadge: {
    backgroundColor: "#fff3e0", borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  cardBadgeText: { fontSize: 10, fontWeight: "700", color: "#e67e22" },
  cardBadgePending: {
    backgroundColor: "#f0f0f0", borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  cardBadgePendingText: { fontSize: 10, fontWeight: "600", color: "#888" },

  // Gesture label row
  gestureRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 12, alignSelf: "center",
  },
  arrowText: { fontSize: 20, color: "#fff" },
  gestureLabel: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.9)", letterSpacing: 0.5 },

  // ─── Sections demo ────────────────────────────────────────────────────────
  sectionsWrap: {
    width: "100%", marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 16, gap: 10,
  },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionCard: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8, padding: 10,
  },
  sectionOverdue: { fontSize: 10, fontWeight: "800", color: "#ff6b6b", width: 90 },
  sectionUpcoming: { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.9)", width: 90 },
  sectionLater: { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.6)", width: 90 },

  // Sort chips
  chipsRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  chipActive: {
    backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  chipActiveText: { fontSize: 11, fontWeight: "700", color: "#e67e22" },
  chip: {
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  chipText: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
});

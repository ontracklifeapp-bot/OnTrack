import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "../utils/theme";

// Emoji picker for tasks and reminders: categories of common emoji, plus a box to
// type/paste any emoji from the device's emoji keyboard.

const CATEGORIES: { name: string; emoji: string[] }[] = [
  { name: "Home", emoji: ["🏠", "🧹", "🧺", "🛁", "🚿", "🛏️", "🪴", "🌿", "🔧", "🪛", "💡", "🗑️", "🧽", "🔑", "🧯", "🪟"] },
  { name: "Health", emoji: ["💊", "🩺", "🦷", "💉", "🧘", "🏃", "🏋️", "🚴", "🥗", "💧", "😴", "🧠", "❤️", "👓", "🩹"] },
  { name: "Money", emoji: ["💳", "💵", "💰", "🏦", "🧾", "📈", "🪙", "💸", "🏷️", "📊"] },
  { name: "School", emoji: ["📚", "✏️", "📝", "📖", "🎒", "🧪", "🔬", "📐", "🎓", "🧮", "💻", "🗂️", "🌍", "🎻"] },
  { name: "Work", emoji: ["💼", "📅", "📧", "🖥️", "📞", "🗓️", "📌", "📎", "🤝", "📋", "⏰"] },
  { name: "People", emoji: ["👥", "👪", "🎂", "🎁", "💌", "👶", "👵", "🧑‍🤝‍🧑", "💍", "🎉", "🙏"] },
  { name: "Food", emoji: ["🛒", "🍎", "🥦", "🍳", "🍕", "☕", "🥛", "🍽️", "🧁", "🥪", "🍱"] },
  { name: "Travel", emoji: ["✈️", "🚗", "🚌", "🚆", "🧳", "🏖️", "🗺️", "⛽", "🅿️", "🏨", "🛂", "⛺"] },
  { name: "Fun", emoji: ["🎮", "🎬", "🎵", "🎨", "📷", "⚽", "🏀", "🎸", "🎯", "🎲", "📺", "🏊"] },
  { name: "Animals", emoji: ["🐾", "🐶", "🐱", "🐟", "🐦", "🐴", "🐢", "🐰", "🐹", "🦎"] },
  { name: "Errands", emoji: ["📦", "✉️", "🏪", "🚙", "🔋", "📱", "🧴", "👕", "✂️", "🗳️", "⚡"] },
];

// First emoji (one "character" as people see it, including skin tones and combined emoji)
function firstEmoji(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  let first: string;
  const Segmenter = (Intl as any).Segmenter;
  if (Segmenter) {
    first = new Segmenter(undefined, { granularity: "grapheme" }).segment(t)[Symbol.iterator]().next().value?.segment ?? "";
  } else {
    first = Array.from(t)[0] ?? "";
  }
  try {
    return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(first) ? first : null;
  } catch {
    return first || null; // very old engines without Unicode property support
  }
}

export default function EmojiPicker({ value, onChange, suggested }: { value: string; onChange: (e: string) => void; suggested: string[] }) {
  const { colors } = useTheme();
  const tabs = [{ name: "Suggested", emoji: suggested }, ...CATEGORIES];
  const [tab, setTab] = useState(0);
  const [custom, setCustom] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const s = styles(colors);

  const onCustom = (text: string) => {
    setCustom(text);
    if (!text.trim()) { setHint(null); return; }
    const e = firstEmoji(text);
    if (e) { onChange(e); setHint(null); setCustom(""); }
    else setHint("That's not an emoji — try the emoji keyboard.");
  };

  return (
    <View>
      <View style={s.selectedRow}>
        <View style={s.selected}><Text style={s.selectedEmoji}>{value}</Text></View>
        <View style={{ flex: 1 }}>
          <TextInput
            style={s.input}
            value={custom}
            onChangeText={onCustom}
            placeholder="Or type any emoji…"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            accessibilityLabel="Type or paste any emoji"
          />
          <Text style={s.help}>{hint ?? "Tip: use your emoji keyboard (Mac: Ctrl + Cmd + Space)."}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {tabs.map((t, i) => (
          <TouchableOpacity key={t.name} onPress={() => setTab(i)} style={[s.tab, i === tab && s.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: i === tab }}>
            <Text style={[s.tabText, i === tab && s.tabTextActive]}>{t.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={s.grid}>
        {tabs[tab].emoji.map((e) => (
          <TouchableOpacity key={e} onPress={() => onChange(e)} style={[s.cell, value === e && s.cellActive]} accessibilityRole="button" accessibilityLabel={`Use ${e}`}>
            <Text style={s.cellEmoji}>{e}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  selectedRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  selected: { width: 56, height: 56, borderRadius: 14, backgroundColor: c.accent + "22", borderWidth: 2, borderColor: c.accent, justifyContent: "center", alignItems: "center" },
  selectedEmoji: { fontSize: 30 },
  input: { backgroundColor: c.input, borderRadius: 10, padding: 10, fontSize: 15, color: c.text, borderWidth: 1.5, borderColor: c.border },
  help: { fontSize: 11, color: c.textMuted, marginTop: 4 },
  tabs: { gap: 6, paddingBottom: 8 },
  tab: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  tabActive: { backgroundColor: c.accent, borderColor: c.accent },
  tabText: { fontSize: 12, fontWeight: "700", color: c.textSub },
  tabTextActive: { color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: 44, height: 44, borderRadius: 10, backgroundColor: c.card, justifyContent: "center", alignItems: "center" },
  cellActive: { backgroundColor: c.accent },
  cellEmoji: { fontSize: 22 },
});

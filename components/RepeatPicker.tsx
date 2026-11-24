import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../utils/theme";

// Repeat choices for reminders. Stored as "" (never) or a word parseRepeat() understands.
export const REMINDER_REPEATS = ["Never", "Daily", "Weekly", "Monthly", "Yearly"] as const;

export function toRepeatValue(choice: string) {
  return choice === "Never" ? "" : choice;
}
export function fromRepeatValue(value?: string) {
  return value && (REMINDER_REPEATS as readonly string[]).includes(value) ? value : "Never";
}

export default function RepeatPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {REMINDER_REPEATS.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, { backgroundColor: active ? colors.accent : colors.card, borderColor: active ? colors.accent : colors.border }]}
          >
            <Text style={[styles.text, { color: active ? "#fff" : colors.textSub }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1.5 },
  text: { fontSize: 13, fontWeight: "600" },
});

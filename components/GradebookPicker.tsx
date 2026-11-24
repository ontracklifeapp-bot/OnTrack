import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Gradebook, GRADEBOOKS } from "../utils/gradebook";
import { useTheme } from "../utils/theme";

// "Which gradebook does your school use?" — Skyward or HAC
export default function GradebookPicker({ value, onPick, compact }: { value: Gradebook | null | undefined; onPick: (g: Gradebook) => void; compact?: boolean }) {
  const { colors } = useTheme();
  const s = styles(colors);
  return (
    <View style={compact ? undefined : s.card}>
      {!compact && (
        <>
          <Text style={s.title}>Which gradebook does your school use?</Text>
          <Text style={s.sub}>Pick the website you check your grades on. You can change this anytime in Settings.</Text>
        </>
      )}
      <View style={s.row}>
        {GRADEBOOKS.map((g) => {
          const active = value === g.id;
          return (
            <TouchableOpacity
              key={g.id}
              style={[s.option, active && s.optionActive]}
              onPress={() => onPick(g.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.optName, active && s.optNameActive]}>{g.name}</Text>
              <Text style={s.optFull}>{g.full}</Text>
              {!g.ready && <Text style={s.soon}>Coming soon</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  title: { fontSize: 17, fontWeight: "900", color: c.text },
  sub: { fontSize: 13, color: c.textMuted, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  row: { flexDirection: "row", gap: 10 },
  option: { flex: 1, borderRadius: 14, padding: 14, backgroundColor: c.input, borderWidth: 2, borderColor: "transparent" },
  optionActive: { borderColor: c.accent, backgroundColor: c.accent + "1a" },
  optName: { fontSize: 18, fontWeight: "900", color: c.text },
  optNameActive: { color: c.accent },
  optFull: { fontSize: 11, color: c.textMuted, marginTop: 2, fontWeight: "600" },
  soon: { alignSelf: "flex-start", marginTop: 8, fontSize: 10, fontWeight: "800", color: "#f5a623", backgroundColor: "#f5a62326", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
});

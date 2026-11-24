import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity } from "react-native";
import { ItemKind } from "../utils/itemNotifications";
import { moveItemToDate, snoozeDate } from "../utils/snooze";
import { useTheme } from "../utils/theme";
import DateTimePicker from "./DateTimePicker";

type ShowToast = (msg: string, action?: { label: string; onPress: () => void }) => void;

// useSnooze(showToast) → { openSnooze(kind, item, name), SnoozeSheet }
// Render {SnoozeSheet} once in the screen; call openSnooze from a card's ⏰ button.
export function useSnooze(showToast: ShowToast) {
  const { colors } = useTheme();
  const [target, setTarget] = useState<{ kind: ItemKind; item: any; name: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(new Date());

  const close = () => { setTarget(null); setPicking(false); };

  const apply = async (date: Date) => {
    if (!target) return;
    const { kind, item } = target;
    close();
    const old = await moveItemToDate(kind, item, date);
    const label = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    showToast(`Moved to ${label}`, { label: "Undo", onPress: () => { moveItemToDate(kind, item, old); } });
  };

  const openSnooze = (kind: ItemKind, item: any, name: string) => {
    const tomorrow = snoozeDate("tomorrow");
    setPicked(tomorrow);
    setPicking(false);
    setTarget({ kind, item, name });
  };

  const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const s = styles;
  const options = [
    { key: "tomorrow" as const, label: "Tomorrow" },
    { key: "3days" as const, label: "In 3 days" },
    { key: "week" as const, label: "Next week" },
  ];

  const SnoozeSheet = (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={s.overlay} onPress={close} accessibilityLabel="Close snooze">
        <Pressable style={[s.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <Text style={[s.title, { color: colors.text }]} numberOfLines={2}>⏰ Snooze “{target?.name}”</Text>
          {!picking ? (
            <>
              {options.map((o) => {
                const d = snoozeDate(o.key);
                return (
                  <TouchableOpacity key={o.key} style={[s.option, { borderColor: colors.border }]} onPress={() => apply(d)} accessibilityRole="button">
                    <Text style={[s.optionLabel, { color: colors.text }]}>{o.label}</Text>
                    <Text style={[s.optionDate, { color: colors.textMuted }]}>{fmt(d)}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={[s.option, { borderColor: colors.border }]} onPress={() => setPicking(true)} accessibilityRole="button">
                <Text style={[s.optionLabel, { color: colors.text }]}>Pick a date…</Text>
                <Text style={[s.optionDate, { color: colors.textMuted }]}>📅</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <DateTimePicker value={picked} mode="date" display="inline" themeVariant="light" onChange={(_: unknown, d?: Date) => d && setPicked(d)} />
              <TouchableOpacity style={[s.confirm, { backgroundColor: colors.accent }]} onPress={() => apply(picked)} accessibilityRole="button">
                <Text style={s.confirmText}>Move to {fmt(picked)}</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={s.cancel} onPress={close} accessibilityRole="button">
            <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return { openSnooze, SnoozeSheet };
}

// Small "⏰ Snooze" pill shown on overdue / today / tomorrow cards
export function SnoozeButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Snooze"
      style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.input }]}
    >
      <Text style={[styles.pillText, { color: colors.textSub }]}>⏰ Snooze</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 20 },
  sheet: { width: "100%", maxWidth: 420, borderRadius: 18, padding: 18 },
  title: { fontSize: 17, fontWeight: "800", marginBottom: 12 },
  option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  optionLabel: { fontSize: 15, fontWeight: "600" },
  optionDate: { fontSize: 13 },
  confirm: { borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4 },
  confirmText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancel: { alignItems: "center", paddingTop: 14 },
  pill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: "700" },
});

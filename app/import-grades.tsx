import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import GradebookPicker from "../components/GradebookPicker";
import { TOP_GAP } from "../constants/layout";
import { useGradebook } from "../utils/gradebook";
import { clearPendingImport, currentSchoolYear, decodeImport, getPendingImport, ImportedClass, saveImport, TERM_LABELS } from "../utils/gradeImport";
import { fmtGrade, gradeBg, gradeTint, sourceName, titleCase } from "../utils/gradeStyle";
import { useTheme } from "../utils/theme";

const TERM_ORDER = ["MP1", "MP2", "EX1", "SM1", "MP3", "MP4", "EX2", "SM2"];

export default function ImportGrades() {
  const { colors } = useTheme();
  const s = styles(colors);
  const [classes, setClasses] = useState<ImportedClass[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [gradebook, setGradebook] = useGradebook();
  // Computers have Grades in the sidebar; phones open it from School
  const gradesHref = useWindowDimensions().width >= 900 ? "/my-grades" : "/grades";

  useEffect(() => {
    const pending = getPendingImport();
    if (!pending) return;
    try {
      const found = decodeImport(pending);
      if (found.length === 0) setError("No grades came through. Open your gradebook's grades page and click the OnTrack extension again.");
      setClasses(found);
    } catch {
      setError("That import link didn't work. Click the OnTrack extension on your gradebook's grades page again.");
      clearPendingImport();
    }
  }, []);

  const save = async () => {
    if (!classes) return;
    setSaving(true);
    try {
      await saveImport(classes);
      // The import says which gradebook it came from — remember it if the student hasn't picked one
      const src = classes[0]?.source;
      if (!gradebook && (src === "skyward" || src === "hac")) await setGradebook(src).catch(() => {});
      clearPendingImport();
      router.replace(gradesHref);
    } catch {
      setError("Couldn't save your grades. Check your connection and try again.");
      setSaving(false);
    }
  };

  const cancel = () => { clearPendingImport(); router.replace(gradesHref); };

  const hasClasses = !!classes && classes.length > 0;
  // This year's classes get full cards; finished years are summarized (they're imported once)
  const thisYear = currentSchoolYear();
  const currentClasses = (classes ?? []).filter((c) => c.year === thisYear);
  const pastByYear = (classes ?? []).filter((c) => c.year !== thisYear).reduce<Record<string, ImportedClass[]>>((acc, c) => {
    (acc[c.year] = acc[c.year] ?? []).push(c);
    return acc;
  }, {});
  const pastYears = Object.keys(pastByYear).sort().reverse();
  const countAssignments = (c: ImportedClass) => Object.values(c.quarters ?? {}).reduce((n, q) => n + q.items.length, 0);
  const totalAssignments = (classes ?? []).reduce((n, c) => n + countAssignments(c), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <TouchableOpacity style={s.backBtn} onPress={cancel}>
          <Text style={s.backText}>← Grades</Text>
        </TouchableOpacity>
        <Text style={s.title}>{hasClasses ? "Review import" : "Import grades"}</Text>

        {hasClasses ? (
          <>
            <Text style={s.subtitle}>
              From {sourceName(classes![0]?.source)} · {classes!.length} class{classes!.length === 1 ? "" : "es"}
              {totalAssignments > 0 ? ` · ${totalAssignments} assignment${totalAssignments === 1 ? "" : "s"}` : ""}
            </Text>
            {currentClasses.map((c) => {
              const latest = TERM_ORDER.slice().reverse().find((t) => c.terms[t] != null);
              const g = latest ? c.terms[latest] : null;
              return (
                <View key={c.year + c.name} style={s.card}>
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.className}>{titleCase(c.name)}</Text>
                      <Text style={s.meta}>
                        {c.year}
                        {c.quarters ? ` · ${countAssignments(c)} assignment${countAssignments(c) === 1 ? "" : "s"} (${Object.keys(c.quarters).map((t) => t.replace("MP", "Q")).join(", ")})` : ""}
                        {Object.values(c.quarters ?? {}).some((q) => q.weights?.length) ? " · weights ✓" : ""}
                      </Text>
                    </View>
                    {g != null && (
                      <View style={[s.badge, { backgroundColor: gradeBg(g) }]}>
                        <Text style={[s.badgeText, { color: gradeTint(g) }]}>{fmtGrade(g)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.terms}>
                    {TERM_ORDER.filter((t) => c.terms[t] != null).map((t) => (
                      <Text key={t} style={s.term}>
                        {TERM_LABELS[t]} <Text style={{ color: gradeTint(c.terms[t]), fontWeight: "900" }}>{fmtGrade(c.terms[t])}</Text>
                      </Text>
                    ))}
                  </View>
                </View>
              );
            })}
            {pastYears.length > 0 && (
              <View style={s.card}>
                <Text style={s.className}>Past years</Text>
                <Text style={s.meta}>Imported once — these don&apos;t change.</Text>
                <View style={s.terms}>
                  {pastYears.map((y) => (
                    <Text key={y} style={s.term}>
                      {y} · <Text style={{ color: colors.text }}>{pastByYear[y].length} class{pastByYear[y].length === 1 ? "" : "es"}</Text>
                    </Text>
                  ))}
                </View>
              </View>
            )}
            {!!error && <Text style={s.error}>{error}</Text>}
          </>
        ) : (
          <>
            {!!error && <Text style={s.error}>{error}</Text>}
            {gradebook === undefined ? null : gradebook === null ? (
              <GradebookPicker value={gradebook} onPick={setGradebook} />
            ) : gradebook === "hac" ? (
              <>
                <Text style={s.subtitle}>Your school uses Home Access Center (HAC).</Text>
                <View style={s.card}>
                  <Text style={s.className}>HAC support is coming soon</Text>
                  <Text style={[s.step, { marginTop: 6 }]}>
                    We&apos;re building the OnTrack extension for HAC next. Until then you can track homework and use the rest of OnTrack as usual.
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setGradebook("skyward")}><Text style={s.switchLink}>My school uses Skyward instead</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.subtitle}>Bring your grades in from Skyward with the OnTrack browser extension. OnTrack never sees your school password.</Text>
                <View style={s.card}>
                  {[
                    "Install the OnTrack extension in Chrome or Edge (on a computer).",
                    "Sign in to Skyward.",
                    "Click the OnTrack icon in your toolbar, then Update OnTrack.",
                    "Check your grades here and tap Save.",
                  ].map((t, i) => (
                    <View key={i} style={s.stepRow}>
                      <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                      <Text style={s.step}>{t}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setGradebook("hac")}><Text style={s.switchLink}>My school uses HAC instead</Text></TouchableOpacity>
              </>
            )}
            {Platform.OS !== "web" && <Text style={s.note}>The extension works on a computer. Your imported grades then show up here too.</Text>}
          </>
        )}
      </ScrollView>

      {hasClasses && (
        <View style={s.footer}>
          <TouchableOpacity onPress={cancel} style={s.cancelBtn} accessibilityRole="button">
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving} accessibilityRole="button">
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save {classes!.length} class{classes!.length === 1 ? "" : "es"}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  content: { padding: 20, paddingBottom: 120, width: "100%", maxWidth: 760, alignSelf: "center" },
  backBtn: { marginTop: TOP_GAP, marginBottom: 6, alignSelf: "flex-start" },
  backText: { fontSize: 15, color: c.accent, fontWeight: "600" },
  title: { fontSize: 30, fontWeight: "900", color: c.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: c.textSub, marginTop: 4, marginBottom: 16, lineHeight: 20 },
  card: { backgroundColor: c.card, borderRadius: 16, padding: 16, marginBottom: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  className: { fontSize: 16, fontWeight: "800", color: c.text },
  meta: { fontSize: 12, color: c.textMuted, marginTop: 3, fontWeight: "600" },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 16, fontWeight: "900" },
  terms: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border },
  term: { fontSize: 13, color: c.textMuted, fontWeight: "700" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: c.accent + "26", alignItems: "center", justifyContent: "center" },
  stepNumText: { color: c.accent, fontWeight: "900", fontSize: 13 },
  step: { flex: 1, fontSize: 14, color: c.textSub, lineHeight: 20 },
  switchLink: { color: c.accent, fontWeight: "700", fontSize: 13, textAlign: "center", paddingVertical: 10 },
  note: { fontSize: 13, color: c.textMuted, marginTop: 8 },
  error: { color: "#e5484d", fontWeight: "700", marginVertical: 12 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, padding: 16, paddingBottom: 24, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border },
  cancelBtn: { paddingHorizontal: 18, justifyContent: "center", borderRadius: 14, backgroundColor: c.card },
  cancelText: { color: c.textSub, fontWeight: "700", fontSize: 15 },
  saveBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 14, padding: 16, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});

import { router, usePathname } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { deleteDoc, onSnapshot, writeBatch } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../firebase/firebase";
import { userCol, userDoc } from "../firebase/userCollection";
import { multiplierFor, unweightedAverage, weightClassFor, WEIGHT_LABELS, weightedAverage } from "../utils/gradeWeights";
import { TOP_GAP } from "../constants/layout";
import DragList from "../components/DragList";
import GradebookPicker from "../components/GradebookPicker";
import { gradebookInfo, useGradebook } from "../utils/gradebook";
import { changeSinceLastImport, quarterFor } from "../utils/gradeCalc";
import { fmtGrade, gradeBg, gradeTint, letterFor, titleCase } from "../utils/gradeStyle";
import { useTheme } from "../utils/theme";

const MP_ORDER = ["MP4", "MP3", "MP2", "MP1"] as const;

type BottomTab = "current" | "previous";
type Semester = "S1" | "S2";

export default function GradesScreen() {
  const { colors } = useTheme();
  const [classes, setClasses] = useState<any[]>([]);
  const [bottomTab, setBottomTab] = useState<BottomTab>("current");
  const [semester, setSemester] = useState<Semester>("S1");
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  useEffect(() => {
    let unsubSnap: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnap) unsubSnap();
      if (!user) { setClasses([]); return; }
      unsubSnap = onSnapshot(userCol("grades"), (snap) => {
        setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    });
    return () => { unsubAuth(); if (unsubSnap) unsubSnap(); };
  }, []);


  // All school years present, newest first
  const years = useMemo(() => {
    const set = new Set<string>();
    classes.forEach((c) => { if (c.year) set.add(c.year); });
    return Array.from(set).sort().reverse();
  }, [classes]);

  const latestYear = years[0] ?? null;
  // Default the previous-tab year selector to the 2nd-newest year
  const prevYears = years.slice(1);
  const activeYear = selectedYear ?? prevYears[0] ?? null;

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Remove ${name}?`, "This removes this class record.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteDoc(userDoc("grades", id)) },
    ]);
  };

  // Most recent import time across all classes
  const lastImported = useMemo(() => {
    const latest = classes.map((c) => c.updatedAt).filter(Boolean).sort().pop();
    return latest ? new Date(latest).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;
  }, [classes]);

  const [gradebook, setGradebook] = useGradebook();
  const s = styles(colors);
  // In the computer sidebar this screen is a tab of its own — no "back to School" link
  const asTab = usePathname() === "/my-grades";

  // ── CURRENT: latest year's classes (or classes with no year, from Grading) ──
  const currentClasses = classes.filter((c) => (latestYear ? c.year === latestYear : c.year == null));
  // Marking periods that actually have data this year (in chronological order)
  const availableTerms = (["MP1", "MP2", "MP3", "MP4"] as const).filter((t) =>
    currentClasses.some((c) => c.terms?.[t] != null)
  );
  // Most recent term with data, used as the default selection
  const latestTerm = MP_ORDER.find((t) => currentClasses.some((c) => c.terms?.[t] != null)) ?? "MP1";
  const currentTerm =
    selectedTerm && availableTerms.includes(selectedTerm as any) ? selectedTerm : latestTerm;
  // Classes in the student's chosen order (then by name)
  const ordered = (list: any[]) => [...list].sort((a, b) =>
    (typeof a.order === "number" ? a.order : 1e6) - (typeof b.order === "number" ? b.order : 1e6) || String(a.name).localeCompare(String(b.name)));
  const currentList = ordered(currentClasses); // every class this year, even without a grade this quarter
  const currentGraded = currentClasses.filter((c) => c.terms?.[currentTerm] != null); // only these count in averages
  // The list shows official grades; the exact decimal grade is shown inside each class
  const gradeOf = (c: any) => c.terms[currentTerm];
  const currentUnweighted = unweightedAverage(currentGraded.map(gradeOf));
  const currentWeighted = weightedAverage(
    currentGraded.map((c) => ({ grade: gradeOf(c), cls: c }))
  );

  // ── PREVIOUS: chosen year + semester grid ──
  const semTerms = semester === "S1" ? (["MP1", "MP2", "EX1", "SM1"] as const) : (["MP3", "MP4", "EX2", "SM2"] as const);
  const yearClasses = classes.filter((c) => c.year === activeYear);
  const yearSemClasses = ordered(yearClasses.filter((c) => semTerms.some((t) => c.terms?.[t] != null)));

  // ── Reorder classes by dragging (saved as `order` on each class) ──
  const [reorder, setReorder] = useState(false);
  const [dragging, setDragging] = useState(false);
  const saveOrder = async (ids: string[]) => {
    const batch = writeBatch(db);
    ids.forEach((id, i) => {
      if (classes.find((c) => c.id === id)?.order !== i) batch.update(userDoc("grades", id), { order: i });
    });
    await batch.commit();
  };

  // Previous quarter, for the ▲/▼ trend on each class
  const prevTerm = ({ MP2: "MP1", MP3: "MP2", MP4: "MP3" } as Record<string, string>)[currentTerm];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={s.container} contentContainerStyle={s.content} scrollEnabled={!dragging}>
        {asTab ? <View style={s.tabTopGap} /> : (
          <TouchableOpacity style={s.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace("/school"))}>
            <Text style={s.backText}>← School</Text>
          </TouchableOpacity>
        )}

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Grades</Text>
            <Text style={s.subtitle}>
              {gradebookInfo(gradebook)?.name ? `${gradebookInfo(gradebook)!.name} · ` : ""}
              {lastImported ? `Updated ${lastImported}` : "No grades imported yet"}
            </Text>
          </View>
          <TouchableOpacity style={s.updateBtn} onPress={() => router.push("/import-grades")} accessibilityRole="button">
            <Text style={s.updateBtnText}>{classes.length > 0 ? "↻ Update" : "＋ Import"}</Text>
          </TouchableOpacity>
        </View>

        {gradebook === null && <GradebookPicker value={gradebook} onPick={setGradebook} />}

        {/* Current / Previous */}
        <View style={s.segment}>
          {(["current", "previous"] as BottomTab[]).map((t) => (
            <TouchableOpacity key={t} style={[s.segmentBtn, bottomTab === t && s.segmentBtnActive]} onPress={() => setBottomTab(t)} accessibilityRole="tab" accessibilityState={{ selected: bottomTab === t }}>
              <Text style={[s.segmentText, bottomTab === t && s.segmentTextActive]}>{t === "current" ? "This year" : "Past years"}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ════════ THIS YEAR ════════ */}
        {bottomTab === "current" && (
          currentList.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyEmoji}>📚</Text>
              <Text style={s.emptyTitle}>No grades yet</Text>
              <Text style={s.emptySub}>Tap Import to bring in your grades from your school&apos;s gradebook with the OnTrack extension.</Text>
            </View>
          ) : (
            <>
              {/* Summary */}
              {currentUnweighted !== null && (
                <View style={s.summary}>
                  <View style={s.summaryTop}>
                    <Text style={s.summaryLabel}>{latestYear ? `${latestYear} · ` : ""}{prettyTerm(currentTerm)} average</Text>
                    <View style={[s.letterPill, { backgroundColor: gradeBg(currentUnweighted) }]}>
                      <Text style={[s.letterPillText, { color: gradeTint(currentUnweighted) }]}>{letterFor(currentUnweighted)}</Text>
                    </View>
                  </View>
                  <View style={s.summaryStats}>
                    <View style={s.stat}>
                      <Text style={s.statValue}>{currentUnweighted.toFixed(2)}</Text>
                      <Text style={s.statLabel}>Unweighted</Text>
                    </View>
                    <View style={s.statDivider} />
                    <View style={s.stat}>
                      <Text style={[s.statValue, { color: colors.accent }]}>{currentWeighted!.toFixed(2)}</Text>
                      <Text style={s.statLabel}>Weighted</Text>
                    </View>
                    <View style={s.statDivider} />
                    <View style={s.stat}>
                      <Text style={s.statValue}>{currentGraded.length === currentList.length ? currentGraded.length : `${currentGraded.length}/${currentList.length}`}</Text>
                      <Text style={s.statLabel}>Classes</Text>
                    </View>
                  </View>

                  {availableTerms.length > 1 && (
                    <View style={s.termRow}>
                      {availableTerms.map((t) => (
                        <TouchableOpacity key={t} style={[s.termChip, currentTerm === t && s.termChipActive]} onPress={() => setSelectedTerm(t)} accessibilityRole="tab" accessibilityState={{ selected: currentTerm === t }}>
                          <Text style={[s.termChipText, currentTerm === t && s.termChipTextActive]}>{prettyTerm(t)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <View style={s.sectionRow}>
                <Text style={[s.sectionLabel, { marginBottom: 0, marginLeft: 0 }]}>CLASSES</Text>
                {currentList.length > 1 && (
                  <TouchableOpacity onPress={() => setReorder((v) => !v)} accessibilityRole="button">
                    <Text style={s.reorderText}>{reorder ? "Done" : "Reorder"}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <DragList
                items={currentList}
                keyOf={(c: any) => c.id}
                enabled={reorder}
                onReorder={saveOrder}
                onDragChange={setDragging}
                renderItem={(c: any) => {
                const missing = c.terms?.[currentTerm] == null; // no grade yet this quarter → shown as 0, not counted
                const g = missing ? 0 : gradeOf(c);
                const before = prevTerm ? c.terms?.[prevTerm] : undefined;
                const delta = !missing && before != null ? g - before : null;
                const qCount = quarterFor(c, currentTerm)?.assignments.length ?? 0;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={s.classCard}
                    onPress={() => !reorder && router.push(`/class-detail?id=${c.id}&term=${currentTerm}&mode=current`)}
                    onLongPress={() => !reorder && handleDelete(c.id, c.name)}
                    accessibilityRole="button"
                    accessibilityLabel={missing ? `${c.name}, no ${prettyTerm(currentTerm)} grade yet` : `${c.name}, ${fmtGrade(g)}`}
                  >
                    <View style={[s.classAccent, { backgroundColor: missing ? colors.border : gradeTint(g) }]} />
                    <View style={s.classInfo}>
                      <Text style={s.className} numberOfLines={1}>{titleCase(c.name)}</Text>
                      <View style={s.classSubRow}>
                        {weightClassFor(c) !== "regular" && (
                          <View style={s.weightTag}><Text style={s.weightTagText}>{WEIGHT_LABELS[weightClassFor(c)]} ×{multiplierFor(c)}</Text></View>
                        )}
                        {delta != null && Math.abs(delta) >= 0.01 && (
                          <Text style={[s.trend, { color: delta > 0 ? "#2ecc71" : "#e5484d" }]}>
                            {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} from {prettyTerm(prevTerm!)}
                          </Text>
                        )}
                        {missing ? (
                          <Text style={s.classMeta}>No {prettyTerm(currentTerm)} grade yet · not counted</Text>
                        ) : qCount > 0 ? (
                          <Text style={s.classMeta}>{qCount} assignments</Text>
                        ) : null}
                      </View>
                    </View>
                    {!missing && changeSinceLastImport(c, currentTerm) != null && (
                      <View
                        style={[s.changePill, { backgroundColor: changeSinceLastImport(c, currentTerm)! > 0 ? "#2ecc7126" : "#e5484d26" }]}
                        accessibilityLabel={`Changed ${changeSinceLastImport(c, currentTerm)} since your last update`}
                      >
                        <Text style={[s.changeText, { color: changeSinceLastImport(c, currentTerm)! > 0 ? "#2ecc71" : "#e5484d" }]}>
                          {changeSinceLastImport(c, currentTerm)! > 0 ? "+" : "−"}{fmtGrade(Math.abs(changeSinceLastImport(c, currentTerm)!))}
                        </Text>
                      </View>
                    )}
                    {missing ? (
                      <View style={[s.gradeBadge, { backgroundColor: colors.input }]}>
                        <Text style={[s.gradeBadgeText, { color: colors.textMuted }]}>0</Text>
                        <Text style={[s.gradeBadgeLetter, { color: colors.textMuted }]}>—</Text>
                      </View>
                    ) : (
                      <View style={[s.gradeBadge, { backgroundColor: gradeBg(g) }]}>
                        <Text style={[s.gradeBadgeText, { color: gradeTint(g) }]}>{fmtGrade(g)}</Text>
                        <Text style={[s.gradeBadgeLetter, { color: gradeTint(g) }]}>{letterFor(g)}</Text>
                      </View>
                    )}
                    {reorder ? (
                      <Text style={s.grip} accessibilityLabel="Drag to reorder">⠿</Text>                    ) : (
                      <Text style={s.chevron}>›</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
              />
              <Text style={s.footHint}>{reorder ? "Drag the classes into the order you want." : "Press and hold a class to remove it."}</Text>
            </>
          )
        )}

        {/* ════════ PAST YEARS ════════ */}
        {bottomTab === "previous" && (
          prevYears.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyEmoji}>🗂️</Text>
              <Text style={s.emptyTitle}>No past years yet</Text>
              <Text style={s.emptySub}>Past years appear here after you import them from your school&apos;s gradebook.</Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.yearScroll}>
                <View style={s.termRow}>
                  {prevYears.map((y) => (
                    <TouchableOpacity key={y} style={[s.termChip, activeYear === y && s.termChipActive]} onPress={() => setSelectedYear(y)}>
                      <Text style={[s.termChipText, activeYear === y && s.termChipTextActive]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={s.segment}>
                {(["S1", "S2"] as Semester[]).map((sm) => (
                  <TouchableOpacity key={sm} style={[s.segmentBtn, semester === sm && s.segmentBtnActive]} onPress={() => setSemester(sm)}>
                    <Text style={[s.segmentText, semester === sm && s.segmentTextActive]}>{sm === "S1" ? "Semester 1" : "Semester 2"}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {yearSemClasses.length === 0 ? (
                <Text style={s.noData}>No {semester === "S1" ? "Semester 1" : "Semester 2"} grades for {activeYear}.</Text>
              ) : (
                <View style={s.gridCard}>
                  <View style={s.gridHeader}>
                    <Text style={s.gridHeaderName}>CLASS</Text>
                    {semTerms.map((t) => <Text key={t} style={s.gridHeaderCell}>{prettyTerm(t).toUpperCase()}</Text>)}
                  </View>
                  {yearSemClasses.map((c, i) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[s.gridRow, i > 0 && s.gridRowBorder]}
                      onPress={() => router.push(`/class-detail?id=${c.id}&term=${semTerms[3]}&mode=history`)}
                      onLongPress={() => handleDelete(c.id, c.name)}
                    >
                      <Text style={s.gridName} numberOfLines={2}>{titleCase(c.name)}</Text>
                      {semTerms.map((t) => {
                        const g = c.terms?.[t];
                        return (
                          <View key={t} style={s.gridCell}>
                            {g != null ? (
                              <View style={[s.gridPill, { backgroundColor: gradeBg(g) }]}>
                                <Text style={[s.gridPillText, { color: gradeTint(g) }]}>{g.toFixed(0)}</Text>
                              </View>
                            ) : (
                              <Text style={s.gridEmpty}>–</Text>
                            )}
                          </View>
                        );
                      })}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )
        )}
      </ScrollView>
    </View>
  );
}

function prettyTerm(t: string): string {
  const map: Record<string, string> = {
    MP1: "Q1", MP2: "Q2", MP3: "Q3", MP4: "Q4",
    EX1: "Exam", EX2: "Exam", SM1: "Sem 1", SM2: "Sem 2",
  };
  return map[t] ?? t;
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, width: "100%", maxWidth: 760, alignSelf: "center" },
  backBtn: { marginTop: TOP_GAP, marginBottom: 6, alignSelf: "flex-start" },
  backText: { fontSize: 15, color: c.accent, fontWeight: "600" },
  tabTopGap: { height: TOP_GAP },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: "900", color: c.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  updateBtn: { backgroundColor: c.accent + "22", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  updateBtnText: { color: c.accent, fontWeight: "800", fontSize: 13 },
  segment: { flexDirection: "row", backgroundColor: c.card, borderRadius: 12, padding: 4, marginBottom: 16 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  segmentBtnActive: { backgroundColor: c.background },
  segmentText: { fontSize: 13, fontWeight: "700", color: c.textMuted },
  segmentTextActive: { color: c.text },
  emptyState: { alignItems: "center", marginTop: 40, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: c.text, marginBottom: 6 },
  emptySub: { fontSize: 14, color: c.textMuted, textAlign: "center", lineHeight: 20 },
  summary: { backgroundColor: c.card, borderRadius: 18, padding: 18, marginBottom: 22, borderWidth: 1, borderColor: c.border },
  summaryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  summaryLabel: { fontSize: 13, fontWeight: "700", color: c.textSub },
  letterPill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  letterPillText: { fontSize: 16, fontWeight: "900" },
  summaryStats: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "900", color: c.text, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: "600", color: c.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: c.border },
  termRow: { flexDirection: "row", gap: 8, marginTop: 16, flexWrap: "wrap" },
  termChip: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: c.input },
  termChipActive: { backgroundColor: c.accent },
  termChipText: { fontSize: 12, fontWeight: "800", color: c.textMuted },
  termChipTextActive: { color: "#fff" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, marginLeft: 4 },
  reorderText: { color: c.accent, fontWeight: "800", fontSize: 13 },
  grip: { fontSize: 22, color: c.accent, marginLeft: 10, paddingHorizontal: 2 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: c.sectionTitle, letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  classCard: { flexDirection: "row", alignItems: "center", backgroundColor: c.card, borderRadius: 14, paddingVertical: 14, paddingRight: 12, overflow: "hidden" },
  classAccent: { width: 4, alignSelf: "stretch", borderRadius: 2, marginRight: 12, marginLeft: 0 },
  classInfo: { flex: 1, marginRight: 10 },
  className: { fontSize: 15, fontWeight: "800", color: c.text, marginBottom: 5 },
  classSubRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  classMeta: { fontSize: 11, color: c.textMuted, fontWeight: "600" },
  trend: { fontSize: 11, fontWeight: "700" },
  weightTag: { backgroundColor: c.accent + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  weightTagText: { fontSize: 10, fontWeight: "800", color: c.accent },
  gradeBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, minWidth: 64, alignItems: "center" },
  gradeBadgeText: { fontWeight: "900", fontSize: 17 },
  gradeBadgeLetter: { fontWeight: "800", fontSize: 10, opacity: 0.8 },
  changePill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginRight: 8 },
  changeText: { fontSize: 12, fontWeight: "900" },
  chevron: { fontSize: 22, color: c.textMuted, marginLeft: 8 },
  footHint: { fontSize: 11, color: c.textMuted, textAlign: "center", marginTop: 10 },
  yearScroll: { marginBottom: 12, flexGrow: 0 },
  noData: { fontSize: 13, color: c.textMuted, textAlign: "center", marginTop: 20 },
  gridCard: { backgroundColor: c.card, borderRadius: 14, paddingVertical: 6 },
  gridHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8 },
  gridHeaderName: { flex: 1, fontSize: 10, fontWeight: "800", color: c.sectionTitle, letterSpacing: 0.5 },
  gridHeaderCell: { width: 50, textAlign: "center", fontSize: 10, fontWeight: "800", color: c.sectionTitle, letterSpacing: 0.5 },
  gridRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 },
  gridRowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  gridName: { flex: 1, fontSize: 13, fontWeight: "700", color: c.text, marginRight: 6 },
  gridCell: { width: 50, alignItems: "center" },
  gridPill: { borderRadius: 8, paddingVertical: 4, minWidth: 40, alignItems: "center" },
  gridPillText: { fontWeight: "900", fontSize: 12 },
  gridEmpty: { color: c.textMuted, fontSize: 14 },
});

import { router, useLocalSearchParams } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { deleteField, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../firebase/firebase";
import { userDoc } from "../firebase/userCollection";
import { multiplierFor, WeightClass, weightClassFor, WEIGHT_CLASSES, WEIGHT_FULL_LABELS, WEIGHT_LABELS, WEIGHT_MULTIPLIERS } from "../utils/gradeWeights";
import { TOP_GAP } from "../constants/layout";
import { adjustedWeights, Assignment, calcGrade, changeSinceLastImport, DEFAULT_CATEGORIES, quarterFor, SEMESTER_QUARTERS, semesterAssignments, semesterGrade } from "../utils/gradeCalc";
import { fmtGrade, gradeBg, gradeTint, letterFor, sourceName, titleCase } from "../utils/gradeStyle";
import { useTheme } from "../utils/theme";

const LETTER_COLOR: Record<string, string> = {
  A: "#27ae60", B: "#2980b9", C: "#e67e22", D: "#e74c3c", F: "#c0392b",
};
function toLetter(p: number) { return p >= 90 ? "A" : p >= 80 ? "B" : p >= 70 ? "C" : p >= 60 ? "D" : "F"; }
function gradeColor(p: number) { return LETTER_COLOR[toLetter(p)] ?? "#888"; }


export default function ClassDetail() {
  const { colors } = useTheme();
  const { id, term, mode } = useLocalSearchParams<{ id: string; term?: string; mode?: string }>();
  const [cls, setCls] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    let unsubSnap: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnap) unsubSnap();
      if (!user) return;
      unsubSnap = onSnapshot(userDoc("grades", id), (snap) => {
        if (snap.exists()) setCls({ id: snap.id, ...snap.data() });
      });
    });
    return () => { unsubAuth(); if (unsubSnap) unsubSnap(); };
  }, [id]);

  const s = styles(colors);
  if (!cls) {
    return <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}><Text style={{ color: colors.textMuted }}>Loading…</Text></View>;
  }

  const isHistory = mode === "history";
  return isHistory
    ? <HistoryView cls={cls} term={term} colors={colors} s={s} id={id!} />
    : <CurrentView cls={cls} colors={colors} s={s} term={term} />;
}

// ══════════════════ CURRENT MODE — gradebook + what-if ══════════════════
function CurrentView({ cls, colors, s, term }: any) {
  // Quarters that have a grade this year (Q1…Q4); each has its own assignments and weights
  const quarters: string[] = (["MP1", "MP2", "MP3", "MP4"] as const).filter((t) => cls.terms?.[t] != null);
  // Semester tabs combine their two quarters (calculated here — nothing extra from Skyward)
  const semesters: string[] = (["SM1", "SM2"] as const).filter((sm) => SEMESTER_QUARTERS[sm].some((t) => quarters.includes(t)));
  const tabs: string[] = [...quarters.slice(0, 2), ...(semesters.includes("SM1") ? ["SM1"] : []), ...quarters.slice(2), ...(semesters.includes("SM2") ? ["SM2"] : [])];
  const [qTerm, setQTerm] = useState<string>(
    term && tabs.includes(term) ? term : cls.assignmentsTerm ?? quarters[quarters.length - 1] ?? "MP1"
  );
  const isSem = qTerm === "SM1" || qTerm === "SM2";
  const quarter = isSem ? null : quarterFor(cls, qTerm);
  const sem = isSem ? semesterGrade(cls, qTerm) : null;
  const realAssignments: Assignment[] = useMemo(
    () => (isSem ? semesterAssignments(cls, qTerm) : quarter?.assignments ?? []),
    [isSem, cls, qTerm, quarter?.assignments]
  );
  // Semester view groups by the latest quarter's categories (assignments from either quarter)
  const semCats = isSem ? [...SEMESTER_QUARTERS[qTerm]].reverse().map((t) => quarterFor(cls, t)?.categories).find((c) => c?.length) : null;
  const categories = (isSem ? semCats : quarter?.categories)?.length ? (isSem ? semCats! : quarter!.categories) : DEFAULT_CATEGORIES;
  const weightsGuessed = !isSem && !!quarter?.weightsGuessed;

  // ── What-if mode: edit any score or add hypothetical grades. Never saved. ──
  const [whatIfOn, setWhatIfOn] = useState(false);
  const [edits, setEdits] = useState<Record<number, { score: string; max: string }>>({});
  // Added what-if grades keep their typed text so they can be edited freely
  const [added, setAdded] = useState<{ key: number; name: string; category: string; score: string; max: string }[]>([]);
  const updateAdded = (key: number, patch: Partial<{ name: string; score: string; max: string }>) =>
    setAdded((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const [adding, setAdding] = useState<string | null>(null); // category being added to
  const [newScore, setNewScore] = useState("");
  const [newMax, setNewMax] = useState("100");

  const switchQuarter = (t: string) => {
    setQTerm(t);
    if (t === "SM1" || t === "SM2") setWhatIfOn(false); // what-if works on one quarter at a time
    setEdits({}); setAdded([]); setAdding(null); // what-if changes belong to one quarter
  };

  const toggleWhatIf = (on: boolean) => {
    setWhatIfOn(on);
    if (!on) { setEdits({}); setAdded([]); setAdding(null); }
  };
  const resetWhatIf = () => { setEdits({}); setAdded([]); setAdding(null); };

  // Real assignments with any what-if edits applied, plus added hypotheticals
  const modified: Assignment[] = useMemo(() => {
    const changed = realAssignments.map((a, i) => {
      const e = edits[i];
      if (!e) return a;
      const sc = parseFloat(e.score), mx = parseFloat(e.max);
      return Number.isFinite(sc) && Number.isFinite(mx) && mx > 0 ? { ...a, score: sc, maxScore: mx } : a;
    });
    const extra: Assignment[] = added.flatMap((a) => {
      const sc = parseFloat(a.score), mx = parseFloat(a.max);
      return Number.isFinite(sc) && Number.isFinite(mx) && mx > 0
        ? [{ name: a.name, category: a.category, score: sc, maxScore: mx, hypothetical: true }]
        : [];
    });
    return [...changed, ...extra];
  }, [realAssignments, edits, added]);

  const hasChanges = Object.keys(edits).length > 0 || added.length > 0;
  const calcNow = isSem ? sem?.grade ?? null : calcGrade(realAssignments, categories);
  const calcProjected = calcGrade(modified, categories);
  // Skyward shows a rounded grade; the exact grade is calculated from the assignments + weights
  const official = cls.terms?.[qTerm];
  const now = calcNow ?? official;
  // What-if shows the straight calculation from the scores and Skyward's weights
  const projected = hasChanges && calcProjected != null ? calcProjected : now;
  const shown = (whatIfOn ? projected : now) ?? 0;
  // Weights that actually apply right now (live in what-if mode)
  const adjusted = adjustedWeights(whatIfOn ? modified : realAssignments, categories);

  const addHypothetical = (category: string) => {
    const sc = parseFloat(newScore), mx = parseFloat(newMax);
    if (!Number.isFinite(sc) || !Number.isFinite(mx) || mx <= 0) return;
    setAdded((p) => [...p, { key: Date.now(), name: "What-if grade", category, score: String(sc), max: String(mx) }]);
    setNewScore(""); setNewMax("100"); setAdding(null);
  };

  // Group by Skyward category; categories without assignments still appear in what-if mode
  const groupFor = (name: string) => ({
    real: realAssignments.map((a, i) => ({ a, i })).filter(({ a }) => (a.category ?? "Major").toLowerCase() === name.toLowerCase()),
    extra: added.filter((a) => (a.category ?? "").toLowerCase() === name.toLowerCase()),
  });
  const known = new Set(categories.map((c: any) => c.name.toLowerCase()));
  const extraCats = [...new Set(realAssignments.map((a) => a.category ?? "Other").filter((n) => !known.has(n.toLowerCase())))];
  const groups = [...categories, ...extraCats.map((n) => ({ name: n, weight: 0 }))]
    .map((cat: any) => ({ cat, ...groupFor(cat.name) }))
    .filter((g) => whatIfOn || g.real.length > 0);

  const [editWeights, setEditWeights] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const notCounted = categories.filter((c: any) => adjusted[c.name.toLowerCase()] == null).map((c: any) => c.name);
  const pctOf = (a: Assignment) => (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : null);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={s.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace("/grades"))}>
        <Text style={s.backText}>← Grades</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={[s.hero, whatIfOn && { borderColor: colors.accent }]}>
        <View style={s.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName} numberOfLines={2}>{titleCase(cls.name)}</Text>
            <View style={s.heroTags}>
              <TouchableOpacity style={s.weightTag} onPress={() => setBoostOpen((v) => !v)} accessibilityRole="button" accessibilityLabel="Change class boost">
                <Text style={s.weightTagText}>{WEIGHT_LABELS[weightClassFor(cls)]} ×{multiplierFor(cls)} ✎</Text>
              </TouchableOpacity>
              {official != null && <Text style={s.heroMeta}>Official grade {official}</Text>}
              {changeSinceLastImport(cls, qTerm) != null && (
                <Text style={[s.heroMeta, { color: changeSinceLastImport(cls, qTerm)! > 0 ? "#2ecc71" : "#e5484d", fontWeight: "800" }]}>
                  {changeSinceLastImport(cls, qTerm)! > 0 ? "▲ +" : "▼ −"}{fmtGrade(Math.abs(changeSinceLastImport(cls, qTerm)!))} since last update
                </Text>
              )}
            </View>
          </View>
          <View style={s.heroGradeWrap}>
            <Text style={[s.heroGrade, { color: whatIfOn && hasChanges ? colors.accent : gradeTint(shown) }]}>{fmtGrade(Math.round(shown * 100) / 100, 2)}</Text>
            <View style={[s.letterPill, { backgroundColor: gradeBg(shown) }]}>
              <Text style={[s.letterPillText, { color: gradeTint(shown) }]}>{letterFor(shown)}</Text>
            </View>
          </View>
        </View>

        {boostOpen && <BoostEditor cls={cls} colors={colors} s={s} onDone={() => setBoostOpen(false)} />}

        {tabs.length > 1 && (
          <View style={s.qRow}>
            {tabs.map((t) => (
              <TouchableOpacity key={t} style={[s.qChip, (t === "SM1" || t === "SM2") && s.semChip, qTerm === t && s.qChipActive]} onPress={() => switchQuarter(t)} accessibilityRole="tab" accessibilityState={{ selected: qTerm === t }}>
                <Text style={[s.qChipText, qTerm === t && s.qChipTextActive]}>{t.replace("MP", "Q").replace("SM", "Sem ")}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {whatIfOn && hasChanges && now != null && (
          <View style={s.projRow}>
            <Text style={s.projText}>
              Now {fmtGrade(now, 2)}{"  "}
              <Text style={{ color: projected >= now ? "#2ecc71" : "#e5484d", fontWeight: "800" }}>
                {projected >= now ? "▲" : "▼"} {Math.abs(projected - now).toFixed(2)}
              </Text>
            </Text>
            <TouchableOpacity onPress={resetWhatIf} accessibilityRole="button"><Text style={s.resetText}>Reset</Text></TouchableOpacity>
          </View>
        )}

        {isSem && sem && (
          <View style={s.semBreakdown}>
            {sem.quarters.map(([t, g]) => (
              <Text key={t} style={s.semLine}>
                {t.replace("MP", "Q")} <Text style={s.semVal}>{g != null ? g.toFixed(2) : "—"}</Text>
                {sem.exam != null && !sem.exempt ? `  × ${sem.mpW}%` : ""}
              </Text>
            ))}
            {sem.exam != null && !sem.exempt ? (
              <Text style={s.semLine}>Exam <Text style={s.semVal}>{fmtGrade(sem.exam)}</Text>  × {sem.exW}%</Text>
            ) : (
              <Text style={s.semNote}>{sem.exempt ? "Exempt from the exam — average of both quarters." : "No exam grade yet — average of both quarters for now."}</Text>
            )}
          </View>
        )}

        {!isSem && (
        <View style={s.whatIfRow}>
          <Text style={s.whatIfLabel}>🔮 What-if mode</Text>
          <Switch value={whatIfOn} onValueChange={toggleWhatIf} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#fff" accessibilityLabel="What-if mode" />
        </View>
        )}
        {whatIfOn && <Text style={s.whatIfHint}>Change any score or add a grade. Nothing is saved.</Text>}
      </View>

      {/* Categories */}
      {realAssignments.length === 0 && !whatIfOn ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>{`No ${qTerm.replace("MP", "Q")} assignments imported yet — run Update OnTrack from your school's gradebook to bring them in. You can still try grades in what-if mode.`}</Text>
        </View>
      ) : (
        groups.map((g: any) => {
          const items: Assignment[] = [
            ...g.real.map(({ i }: any) => modified[i]),
            ...modified.slice(realAssignments.length).filter((a) => (a.category ?? "").toLowerCase() === g.cat.name.toLowerCase()),
          ];
          const scored = items.filter((a) => a.maxScore > 0);
          const earned = scored.reduce((sum, a) => sum + a.score, 0);
          const total = scored.reduce((sum, a) => sum + a.maxScore, 0);
          const avg = total > 0 ? (earned / total) * 100 : null;
          const adj = adjusted[g.cat.name.toLowerCase()];
          return (
            <View key={g.cat.name} style={s.catCard}>
              <View style={s.catTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.catName}>{g.cat.name}</Text>
                  <Text style={s.catWeight}>
                    {adj == null ? "Not counted yet" : Math.abs(adj - g.cat.weight) < 0.05 ? `${g.cat.weight}% of grade` : `${adj.toFixed(1)}% of grade · normally ${g.cat.weight}%`}
                  </Text>
                </View>
                {avg != null && <Text style={[s.catAvg, { color: gradeTint(avg) }]}>{fmtGrade(Math.round(avg * 10) / 10)}</Text>}
              </View>
              {avg != null && (
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${Math.min(100, avg)}%`, backgroundColor: gradeTint(avg) }]} />
                </View>
              )}

              {g.real.map(({ a, i }: any) => {
                const e = edits[i];
                const cur = modified[i];
                const p = pctOf(cur);
                return (
                  <View key={i} style={[s.asg, e && s.asgEdited]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={s.asgName} numberOfLines={2}>{a.name}</Text>
                      {(!!(a as any).due || isSem) && (
                        <Text style={s.asgDue}>
                          {isSem && (a as any).quarter ? `${(a as any).quarter.replace("MP", "Q")}${(a as any).due ? " · " : ""}` : ""}
                          {(a as any).due ? `Due ${(a as any).due}` : ""}
                        </Text>
                      )}
                    </View>
                    {whatIfOn ? (
                      <View style={s.asgEdit}>
                        <TextInput
                          style={s.asgInput}
                          value={e ? e.score : a.maxScore > 0 ? String(a.score) : ""}
                          placeholder="—"
                          placeholderTextColor={colors.textMuted}
                          onChangeText={(v) => setEdits((p2) => ({ ...p2, [i]: { score: v.replace(/[^0-9.]/g, ""), max: p2[i]?.max ?? String(a.maxScore > 0 ? a.maxScore : 100) } }))}
                          keyboardType="decimal-pad"
                          accessibilityLabel={`What-if score for ${a.name}`}
                        />
                        <Text style={s.slashText}>/</Text>
                        <TextInput
                          style={[s.asgInput, s.asgInputMax]}
                          value={e ? e.max : String(a.maxScore > 0 ? a.maxScore : 100)}
                          onChangeText={(v) => setEdits((p2) => ({ ...p2, [i]: { score: p2[i]?.score ?? (a.maxScore > 0 ? String(a.score) : ""), max: v.replace(/[^0-9.]/g, "") } }))}
                          keyboardType="decimal-pad"
                          accessibilityLabel={`Points possible for ${a.name}`}
                        />
                      </View>
                    ) : p != null ? (
                      <View style={s.asgRight}>
                        <Text style={[s.asgPct, { color: gradeTint(p) }]}>{fmtGrade(Math.round(p * 10) / 10)}%</Text>
                        <Text style={s.asgPts}>{cur.score}/{cur.maxScore}</Text>
                      </View>
                    ) : (
                      <Text style={s.asgUngraded}>Not graded</Text>
                    )}
                  </View>
                );
              })}

              {g.extra.map((a: any) => (
                <View key={a.key} style={[s.asg, s.asgEdited]}>
                  <TextInput
                    style={[s.asgName, s.asgNameInput]}
                    value={a.name}
                    onChangeText={(v) => updateAdded(a.key, { name: v.slice(0, 60) })}
                    placeholder="What-if grade"
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel="What-if grade name"
                  />
                  <View style={s.asgEdit}>
                    <TextInput style={s.asgInput} value={a.score} onChangeText={(v) => updateAdded(a.key, { score: v.replace(/[^0-9.]/g, "") })} placeholder="—" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" accessibilityLabel={`Score for ${a.name}`} />
                    <Text style={s.slashText}>/</Text>
                    <TextInput style={[s.asgInput, s.asgInputMax]} value={a.max} onChangeText={(v) => updateAdded(a.key, { max: v.replace(/[^0-9.]/g, "") })} keyboardType="decimal-pad" accessibilityLabel={`Points possible for ${a.name}`} />
                  </View>
                  <TouchableOpacity onPress={() => setAdded((p2) => p2.filter((x) => x.key !== a.key))} accessibilityLabel="Remove what-if grade" hitSlop={8}>
                    <Text style={s.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {whatIfOn && (adding === g.cat.name ? (
                <View style={s.addRow}>
                  <TextInput style={s.asgInput} value={newScore} onChangeText={(v) => setNewScore(v.replace(/[^0-9.]/g, ""))} placeholder="Score" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" autoFocus />
                  <Text style={s.slashText}>/</Text>
                  <TextInput style={[s.asgInput, s.asgInputMax]} value={newMax} onChangeText={(v) => setNewMax(v.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" onSubmitEditing={() => addHypothetical(g.cat.name)} />
                  <TouchableOpacity style={s.addBtnSmall} onPress={() => addHypothetical(g.cat.name)}><Text style={s.addBtnSmallText}>Add</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setAdding(null)} hitSlop={8}><Text style={s.removeText}>✕</Text></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => { setAdding(g.cat.name); setNewScore(""); setNewMax("100"); }} accessibilityRole="button">
                  <Text style={s.addLink}>＋ Add a grade</Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        })
      )}

      {!whatIfOn && notCounted.length > 0 && (
        <Text style={s.notCounted}>Not counted yet (no grades): {notCounted.join(", ")}</Text>
      )}

      {/* Weights (per quarter) */}
      {!isSem && <TouchableOpacity style={s.weightsToggle} onPress={() => setEditWeights((v) => !v)} accessibilityRole="button">
        <Text style={s.weightsToggleText}>⚖️ {editWeights ? "Hide weights" : "Edit category weights"}</Text>
        {weightsGuessed && !editWeights && <Text style={s.weightsWarn}>Check these</Text>}
        {!weightsGuessed && quarter?.weightsCustom && !editWeights && <Text style={s.weightsCustomTag}>Custom</Text>}
      </TouchableOpacity>}
      {!isSem && (editWeights || weightsGuessed) && (
        <WeightsEditor cls={cls} term={qTerm} perQuarter={!!cls.quarters?.[qTerm]} weightsGuessed={weightsGuessed} quarter={quarter} categories={categories} adjusted={adjusted} colors={colors} s={s} />
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// Class boost for the weighted average (AP ×1.15 etc.) — pick a level or type a custom multiplier
function BoostEditor({ cls, colors, s, onDone }: any) {
  const current = weightClassFor(cls);
  const [custom, setCustom] = useState(typeof cls.multiplier === "number" ? String(cls.multiplier) : "");
  const save = (patch: Record<string, unknown>) => { if (cls.id) updateDoc(userDoc("grades", cls.id), patch); };
  const pick = (wc: WeightClass) => { save({ weightClass: wc, multiplier: deleteField() }); setCustom(""); };
  const saveCustom = () => {
    const m = parseFloat(custom);
    if (Number.isFinite(m) && m >= 1 && m <= 2) save({ multiplier: Math.round(m * 1000) / 1000 });
    else if (!custom.trim()) save({ multiplier: deleteField() });
  };
  return (
    <View style={s.boostBox}>
      <Text style={s.boostTitle}>Class boost</Text>
      <Text style={s.hint}>How much this class counts in your weighted average.</Text>
      <View style={s.boostRow}>
        {WEIGHT_CLASSES.map((wc) => {
          const active = current === wc && typeof cls.multiplier !== "number";
          return (
            <TouchableOpacity key={wc} style={[s.qChip, s.boostChip, active && s.qChipActive]} onPress={() => pick(wc)} accessibilityRole="radio" accessibilityState={{ selected: active }}>
              <Text style={[s.qChipText, active && s.qChipTextActive]}>{WEIGHT_FULL_LABELS[wc]} ×{WEIGHT_MULTIPLIERS[wc]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.boostCustom}>
        <Text style={s.hint}>Custom ×</Text>
        <TextInput
          style={[s.asgInput, s.boostInput]}
          value={custom}
          onChangeText={(v) => setCustom(v.replace(/[^0-9.]/g, ""))}
          onBlur={saveCustom}
          onSubmitEditing={saveCustom}
          placeholder="e.g. 1.1"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          accessibilityLabel="Custom boost multiplier"
        />
        <Text style={[s.hint, { flex: 1 }]}>between 1 and 2</Text>
        <TouchableOpacity onPress={onDone}><Text style={s.resetText}>Done</Text></TouchableOpacity>
      </View>
    </View>
  );
}

// Category weights — editable. Skyward doesn't show them, so imports start with even weights
// (weightsGuessed) until the student enters the real ones from their syllabus.
function WeightsEditor({ cls, term, perQuarter, weightsGuessed, quarter, categories, adjusted, colors, s }: any) {
  const [draft, setDraft] = useState<string[]>(() => categories.map((c: any) => String(c.weight)));
  useEffect(() => { setDraft(categories.map((c: any) => String(c.weight))); }, [categories]);
  const total = draft.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const save = () => {
    if (!cls.id) return;
    const next = categories.map((c: any, i: number) => ({ name: c.name, weight: Math.max(0, Math.min(100, parseFloat(draft[i]) || 0)) }));
    // Edited weights are marked custom so future imports keep them
    updateDoc(userDoc("grades", cls.id), perQuarter
      ? { [`quarters.${term}.categories`]: next, [`quarters.${term}.weightsGuessed`]: false, [`quarters.${term}.weightsCustom`]: true }
      : { categories: next, weightsGuessed: false });
  };
  const official: { name: string; weight: number }[] | undefined = quarter?.officialCategories;
  const useOfficial = () => {
    if (!cls.id || !perQuarter || !official?.length) return;
    updateDoc(userDoc("grades", cls.id), {
      [`quarters.${term}.categories`]: official,
      [`quarters.${term}.weightsCustom`]: false,
      [`quarters.${term}.weightsGuessed`]: false,
    });
  };
  return (
    <View style={s.card}>
      {quarter?.weightsCustom && (
        <View style={s.customRow}>
          <Text style={[s.hint, { flex: 1 }]}>{"You've changed these weights. Future updates keep yours."}</Text>
          {!!official?.length && (
            <TouchableOpacity onPress={useOfficial} accessibilityRole="button"><Text style={s.resetText}>Use official weights</Text></TouchableOpacity>
          )}
        </View>
      )}
      {weightsGuessed && (
        <Text style={[s.hint, { marginBottom: 8, color: "#e67e22" }]}>
          {`⚠️ These weights are split evenly because ${sourceName(cls.source)} didn't list them for this class. Enter the real percentages from your syllabus for an accurate grade.`}
        </Text>
      )}
      {categories.map((cat: any, i: number) => (
        <View key={cat.name} style={s.catWeightRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.catWeightName, adjusted?.[cat.name.toLowerCase()] == null && { opacity: 0.5 }]}>{cat.name}</Text>
            <Text style={s.hint}>
              {adjusted?.[cat.name.toLowerCase()] == null
                ? "No grades yet · not counted"
                : Math.abs(adjusted[cat.name.toLowerCase()] - cat.weight) < 0.05
                  ? "Counts in full"
                  : `Counts as ${adjusted[cat.name.toLowerCase()].toFixed(2)}% for now`}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <TextInput
              style={[s.wInput, { width: 64, textAlign: "right" }]}
              value={draft[i] ?? ""}
              onChangeText={(v) => setDraft((d) => d.map((x, j) => (j === i ? v.replace(/[^0-9.]/g, "") : x)))}
              onBlur={save}
              keyboardType="decimal-pad"
              accessibilityLabel={`${cat.name} weight percent`}
            />
            <Text style={s.catWeightPct}>%</Text>
          </View>
        </View>
      ))}
      {Math.abs(total - 100) > 0.5 && (
        <Text style={[s.hint, { marginTop: 8 }]}>Weights add up to {Math.round(total * 10) / 10}% — they usually total 100%.</Text>
      )}
      {!cls.categories?.length && (
        <Text style={[s.hint, { marginTop: 8 }]}>Using default 60/40 until assignments are imported.</Text>
      )}
    </View>
  );
}

// ══════════════════ HISTORY MODE — term strip + semester calc ══════════════════
function HistoryView({ cls, term, colors, s, id }: any) {
  const TERMS = ["MP1", "MP2", "SM1", "MP3", "MP4", "SM2"];
  const terms = cls.terms ?? {};
  const [semester, setSemester] = useState<"SM1" | "SM2">(term === "MP3" || term === "MP4" || term === "SM2" ? "SM2" : "SM1");
  const [mpWeight, setMpWeight] = useState(String(cls.semesterConfig?.mpWeight ?? 42.5));
  const [finalWeight, setFinalWeight] = useState(String(cls.semesterConfig?.finalWeight ?? 15));
  const [exempt, setExempt] = useState(!!cls.semesterConfig?.exempt);
  const [finalScore, setFinalScore] = useState("");
  const [target, setTarget] = useState("90");

  // `ex` lets the Exempt switch save its new value right away (state updates aren't instant)
  const saveWeights = (ex: boolean = exempt) => updateDoc(userDoc("grades", id), {
    semesterConfig: { mpWeight: parseFloat(mpWeight) || 42.5, finalWeight: parseFloat(finalWeight) || 15, exempt: ex },
  });

  const mpA = semester === "SM1" ? terms.MP1 : terms.MP3;
  const mpB = semester === "SM1" ? terms.MP2 : terms.MP4;
  const mpW = parseFloat(mpWeight) || 0, fW = exempt ? 0 : parseFloat(finalWeight) || 0, fS = parseFloat(finalScore);
  let sem: number | null = null;
  if (mpA != null && mpB != null) {
    if (exempt) sem = (mpA + mpB) / 2;
    else if (!isNaN(fS)) sem = (mpA * mpW + mpB * mpW + fS * fW) / (2 * mpW + fW);
  }
  let need: number | null = null;
  const tg = parseFloat(target);
  if (!exempt && mpA != null && mpB != null && !isNaN(tg) && fW > 0) need = (tg * (2 * mpW + fW) - mpW * (mpA + mpB)) / fW;
  const shown = sem ?? (term && terms[term] != null ? terms[term] : (mpA ?? 0));
  const lc = gradeColor(shown);

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>

      <View style={[s.heroCard, { borderColor: lc }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroClass} numberOfLines={2}>{cls.name}</Text>
          {cls.year && <Text style={s.heroSub}>{cls.year}</Text>}
        </View>
        <View style={[s.histGrade, { backgroundColor: lc }]}><Text style={s.histGradeText}>{shown.toFixed(2)}</Text></View>
      </View>

      <View style={s.termsStrip}>
        {TERMS.map((t) => (
          <View key={t} style={[s.termChip, terms[t] == null && { opacity: 0.35 }]}>
            <Text style={s.termChipLabel}>{t}</Text>
            <Text style={[s.termChipValue, terms[t] != null && { color: gradeColor(terms[t]) }]}>{terms[t] != null ? terms[t].toFixed(1) : "–"}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sectionTitle}>🎯 SEMESTER CALCULATOR</Text>
      <View style={s.card}>
        <View style={s.semToggle}>
          {(["SM1", "SM2"] as const).map((sm) => (
            <TouchableOpacity key={sm} style={[s.semBtn, semester === sm && s.semBtnActive]} onPress={() => setSemester(sm)}>
              <Text style={[s.semBtnText, semester === sm && s.semBtnTextActive]}>{sm === "SM1" ? "Semester 1" : "Semester 2"}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.mpRow}>
          <View style={s.mpBox}><Text style={s.mpLabel}>{semester === "SM1" ? "MP1" : "MP3"}</Text><Text style={[s.mpVal, mpA != null && { color: gradeColor(mpA) }]}>{mpA != null ? mpA.toFixed(1) : "–"}</Text></View>
          <View style={s.mpBox}><Text style={s.mpLabel}>{semester === "SM1" ? "MP2" : "MP4"}</Text><Text style={[s.mpVal, mpB != null && { color: gradeColor(mpB) }]}>{mpB != null ? mpB.toFixed(1) : "–"}</Text></View>
        </View>

        <View style={s.weightRow}>
          <View style={s.wField}><Text style={s.wLabel}>Each MP %</Text><TextInput style={s.wInput} value={mpWeight} onChangeText={setMpWeight} keyboardType="decimal-pad" onBlur={() => saveWeights()} /></View>
          <View style={s.wField}><Text style={s.wLabel}>Final %</Text><TextInput style={[s.wInput, exempt && { opacity: 0.4 }]} value={finalWeight} onChangeText={setFinalWeight} keyboardType="decimal-pad" editable={!exempt} onBlur={() => saveWeights()} /></View>
          <View style={s.wField}><Text style={s.wLabel}>Exempt</Text><Switch value={exempt} onValueChange={(v) => { setExempt(v); saveWeights(v); }} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#fff" /></View>
        </View>

        {!exempt && (
          <View style={s.finalRow}>
            <Text style={s.finalLabel}>Final exam score:</Text>
            <TextInput style={s.finalInput} value={finalScore} onChangeText={setFinalScore} placeholder="e.g. 85" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
          </View>
        )}

        {sem != null && (
          <View style={[s.semResult, { backgroundColor: gradeColor(sem) }]}>
            <Text style={s.semResultLabel}>{semester} Grade</Text>
            <Text style={s.semResultVal}>{sem.toFixed(2)}  ({toLetter(sem)})</Text>
          </View>
        )}

        {!exempt && mpA != null && mpB != null && (
          <View style={s.needRow}>
            <Text style={s.needLabel}>To get a</Text>
            <TextInput style={s.needInput} value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
            <Text style={s.needLabel}>you need</Text>
            <Text style={[s.needVal, { color: need != null && need > 100 ? "#e74c3c" : "#27ae60" }]}>{need != null ? `${need.toFixed(2)}%` : "–"}</Text>
          </View>
        )}
        {need != null && need > 100 && <Text style={s.impossible}>⚠️ Not reachable — needs over 100%</Text>}
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = (c: ReturnType<typeof import("../utils/theme").useTheme>["colors"]) => StyleSheet.create({
  boostBox: { marginTop: 12, backgroundColor: c.input, borderRadius: 12, padding: 12 },
  boostTitle: { fontSize: 14, fontWeight: "800", color: c.text, marginBottom: 2 },
  boostRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  boostChip: { backgroundColor: c.card },
  boostInput: { width: 84, backgroundColor: c.card },
  boostCustom: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  weightsCustomTag: { fontSize: 11, fontWeight: "800", color: c.accent, backgroundColor: c.accent + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  customRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  semChip: { borderWidth: 1.5, borderColor: c.accent + "55" },
  semBreakdown: { marginTop: 12, backgroundColor: c.input, borderRadius: 10, padding: 12, gap: 4 },
  semLine: { fontSize: 13, color: c.textMuted, fontWeight: "600" },
  semVal: { color: c.text, fontWeight: "800" },
  semNote: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  qRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  qChip: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: c.input },
  qChipActive: { backgroundColor: c.accent },
  qChipText: { fontSize: 13, fontWeight: "800", color: c.textMuted },
  qChipTextActive: { color: "#fff" },
  content: { padding: 20, paddingBottom: 40, width: "100%", maxWidth: 760, alignSelf: "center" },
  hero: { backgroundColor: c.card, borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1.5, borderColor: c.border },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroName: { fontSize: 22, fontWeight: "900", color: c.text, letterSpacing: -0.3 },
  heroTags: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  heroMeta: { fontSize: 12, color: c.textMuted, fontWeight: "600" },
  heroGradeWrap: { alignItems: "flex-end" },
  heroGrade: { fontSize: 36, fontWeight: "900", letterSpacing: -1 },
  letterPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2, marginTop: 2 },
  letterPillText: { fontSize: 13, fontWeight: "900" },
  projRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, backgroundColor: c.input, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  projText: { fontSize: 13, color: c.textSub, fontWeight: "600" },
  resetText: { fontSize: 13, color: c.accent, fontWeight: "800" },
  whatIfRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  whatIfLabel: { fontSize: 14, fontWeight: "800", color: c.text },
  whatIfHint: { fontSize: 12, color: c.textMuted, marginTop: 4 },
  emptyCard: { backgroundColor: c.card, borderRadius: 16, padding: 18 },
  emptyText: { fontSize: 14, color: c.textMuted, lineHeight: 20 },
  catCard: { backgroundColor: c.card, borderRadius: 16, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, marginBottom: 12 },
  catTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  catName: { fontSize: 16, fontWeight: "800", color: c.text },
  catWeight: { fontSize: 12, color: c.textMuted, marginTop: 2, fontWeight: "600" },
  catAvg: { fontSize: 22, fontWeight: "900" },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: c.input, marginTop: 10, marginBottom: 6, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  asg: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border },
  asgEdited: { backgroundColor: c.accent + "18", marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 10, borderTopColor: "transparent" },
  asgName: { fontSize: 14, fontWeight: "600", color: c.text },
  asgDue: { fontSize: 11, color: c.textMuted, marginTop: 2 },
  asgRight: { alignItems: "flex-end" },
  asgPct: { fontSize: 15, fontWeight: "900" },
  asgPts: { fontSize: 11, color: c.textMuted, marginTop: 1 },
  asgUngraded: { fontSize: 12, color: c.textMuted, fontWeight: "600" },
  asgNameInput: { flex: 1, backgroundColor: c.input, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, marginRight: 8 },
  asgEdit: { flexDirection: "row", alignItems: "center", gap: 4 },
  asgInput: { width: 58, backgroundColor: c.input, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 8, fontSize: 14, fontWeight: "800", color: c.text, textAlign: "right" },
  asgInputMax: { width: 50, fontWeight: "600", color: c.textSub },
  slashText: { color: c.textMuted, fontSize: 14 },
  removeText: { color: c.textMuted, fontSize: 15, fontWeight: "700", marginLeft: 10 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border },
  addBtnSmall: { backgroundColor: c.accent, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, marginLeft: 6 },
  addBtnSmallText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  addLink: { color: c.accent, fontWeight: "800", fontSize: 13, paddingVertical: 10 },
  notCounted: { fontSize: 12, color: c.textMuted, textAlign: "center", marginTop: 2, marginBottom: 6 },
  weightsToggle: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 14 },
  weightsToggleText: { color: c.accent, fontWeight: "800", fontSize: 14 },
  weightsWarn: { fontSize: 11, fontWeight: "800", color: "#f5a623", backgroundColor: "#f5a62326", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  whatIfBar: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.card, borderRadius: 14, padding: 14, marginTop: 14, borderWidth: 1.5, borderColor: c.border },
  whatIfBarTitle: { fontSize: 15, fontWeight: "800", color: c.text, marginBottom: 2 },
  asgRowEdited: { backgroundColor: c.accent + "1f", borderRadius: 8 },
  addRowBtn: { backgroundColor: c.accent, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, marginLeft: 6 },
  addRowBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  addGradeLink: { color: c.accent, fontWeight: "700", fontSize: 13, paddingVertical: 8 },
  whatIfToggle: { borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1.5, borderColor: c.accent, marginTop: 20, marginBottom: 10 },
  whatIfToggleText: { color: c.accent, fontWeight: "700", fontSize: 15 },
  container: { flex: 1, backgroundColor: c.background, padding: 20 },
  backBtn: { marginTop: TOP_GAP, marginBottom: 8 },
  backText: { color: c.accent, fontSize: 16, fontWeight: "600" },
  heroCard: { backgroundColor: c.card, borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 2, marginBottom: 12 },
  heroClass: { fontSize: 18, fontWeight: "800", color: c.text },
  heroSub: { fontSize: 12, color: c.textMuted, fontWeight: "600" },
  histGrade: { minWidth: 64, height: 56, borderRadius: 14, paddingHorizontal: 10, justifyContent: "center", alignItems: "center" },
  heroGradeText: { fontSize: 20, fontWeight: "800", color: "#fff" },
  weightTag: { backgroundColor: c.accent + "22", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  weightTagText: { fontSize: 10, fontWeight: "700", color: c.accent },
  projBadge: { backgroundColor: "#6C63FF20", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  projBadgeText: { fontSize: 10, fontWeight: "700", color: "#6C63FF" },
  diffRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.card, borderRadius: 12, padding: 12, marginBottom: 12 },
  diffLabel: { fontSize: 12, color: c.textMuted },
  diffDelta: { fontSize: 13, fontWeight: "800", flex: 1 },
  resetBtn: { backgroundColor: c.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  resetBtnText: { fontSize: 11, fontWeight: "700", color: c.textMuted },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: c.sectionTitle, letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  card: { backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 16 },
  hint: { fontSize: 12, color: c.textMuted, lineHeight: 18 },
  input: { backgroundColor: c.input, borderRadius: 10, padding: 12, fontSize: 14, color: c.text, borderWidth: 1.5, borderColor: c.border, marginBottom: 10 },
  typeRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  typeChip: { flex: 1, backgroundColor: c.input, borderRadius: 10, paddingVertical: 9, alignItems: "center", borderWidth: 1.5, borderColor: c.border },
  typeChipActive: { backgroundColor: c.accent, borderColor: c.accent },
  typeChipText: { fontSize: 12, fontWeight: "700", color: c.textMuted },
  typeChipTextActive: { color: "#fff" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  slash: { fontSize: 20, color: c.textMuted },
  addBtn: { backgroundColor: "#6C63FF", borderRadius: 12, padding: 12, alignItems: "center", marginTop: 10 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  miniTag: { backgroundColor: "#6C63FF22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  miniTagText: { fontSize: 10, fontWeight: "700", color: "#6C63FF" },
  whatIfName: { flex: 1, fontSize: 13, color: c.text },
  whatIfScore: { fontSize: 13, fontWeight: "700", color: c.text },
  removeX: { fontSize: 12, color: "#e74c3c", fontWeight: "700", paddingHorizontal: 4 },
  catWeightRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  catWeightName: { fontSize: 13, fontWeight: "600", color: c.text },
  catWeightPct: { fontSize: 13, fontWeight: "800", color: c.accent },
  catGroup: { backgroundColor: c.card, borderRadius: 14, marginBottom: 10, overflow: "hidden" },
  catHeader: { flexDirection: "row", justifyContent: "space-between", padding: 12, backgroundColor: c.input },
  catHeaderName: { fontSize: 13, fontWeight: "700", color: c.text },
  catHeaderMeta: { fontSize: 12, color: c.textMuted },
  asgRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderTopWidth: 1, borderTopColor: c.border },
  asgScore: { fontSize: 14, fontWeight: "800" },
  asgMax: { fontSize: 11, color: c.textMuted, fontWeight: "400" },
  // history
  termsStrip: { flexDirection: "row", gap: 5, marginBottom: 16 },
  termChip: { flex: 1, backgroundColor: c.card, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  termChipLabel: { fontSize: 9, fontWeight: "700", color: c.textMuted },
  termChipValue: { fontSize: 12, fontWeight: "800", color: c.text, marginTop: 2 },
  semToggle: { flexDirection: "row", backgroundColor: c.input, borderRadius: 10, padding: 3, marginBottom: 14 },
  semBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  semBtnActive: { backgroundColor: c.accent },
  semBtnText: { fontSize: 13, fontWeight: "600", color: c.textMuted },
  semBtnTextActive: { color: "#fff" },
  mpRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  mpBox: { flex: 1, backgroundColor: c.input, borderRadius: 10, padding: 12, alignItems: "center" },
  mpLabel: { fontSize: 10, fontWeight: "700", color: c.textMuted },
  mpVal: { fontSize: 20, fontWeight: "800", color: c.text, marginTop: 2 },
  weightRow: { flexDirection: "row", gap: 12, alignItems: "flex-end", marginBottom: 14 },
  wField: { flex: 1, alignItems: "center", gap: 6 },
  wLabel: { fontSize: 10, fontWeight: "700", color: c.textMuted },
  wInput: { backgroundColor: c.input, borderRadius: 8, padding: 8, fontSize: 14, fontWeight: "700", color: c.text, textAlign: "center", borderWidth: 1.5, borderColor: c.border, width: "100%" },
  finalRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  finalLabel: { fontSize: 13, color: c.text, fontWeight: "600" },
  finalInput: { flex: 1, backgroundColor: c.input, borderRadius: 8, padding: 8, fontSize: 14, color: c.text, borderWidth: 1.5, borderColor: c.border },
  semResult: { borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 10 },
  semResultLabel: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "700" },
  semResultVal: { fontSize: 20, fontWeight: "800", color: "#fff", marginTop: 2 },
  needRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 },
  needLabel: { fontSize: 13, color: c.textMuted },
  needInput: { backgroundColor: c.input, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, fontWeight: "700", color: c.text, borderWidth: 1.5, borderColor: c.border, width: 56, textAlign: "center" },
  needVal: { fontSize: 16, fontWeight: "800" },
  impossible: { fontSize: 12, color: "#e74c3c", fontWeight: "600", marginTop: 6 },
});

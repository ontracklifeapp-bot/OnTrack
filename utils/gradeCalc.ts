// Grade math shared by the Grades list and the class screen.

export type Assignment = { name?: string; score: number; maxScore: number; category?: string; type?: string; hypothetical?: boolean };

// Default category weights when a class hasn't synced its real ones (a common 60/40 split)
export const DEFAULT_CATEGORIES = [{ name: "Major", weight: 60 }, { name: "Daily", weight: 40 }];

// Skyward-style "Adjusted Weight": categories with no graded work are left out, and their share is
// spread proportionally over the rest (e.g. 10/10/30/50 with no quizzes → 14.29/14.29/–/71.43).
export function adjustedWeights(assignments: Assignment[], categories: { name: string; weight: number }[]) {
  const graded = new Set(assignments.filter((a) => a.maxScore > 0).map((a) => (a.category ?? "Major").toLowerCase()));
  const active = categories.filter((c) => graded.has(c.name.toLowerCase()));
  const sum = active.reduce((t, c) => t + c.weight, 0);
  const out: Record<string, number | null> = {};
  categories.forEach((c) => { out[c.name.toLowerCase()] = graded.has(c.name.toLowerCase()) && sum > 0 ? (c.weight / sum) * 100 : null; });
  return out;
}

// Weighted grade from assignments grouped by category
export function calcGrade(assignments: Assignment[], categories: { name: string; weight: number }[]): number | null {
  const valid = assignments.filter((a) => a.maxScore > 0);
  if (valid.length === 0) return null;
  let weighted = 0, wsum = 0;
  for (const cat of categories) {
    const inCat = valid.filter((a) => (a.category ?? "Major").toLowerCase() === cat.name.toLowerCase());
    if (inCat.length === 0) continue;
    const earned = inCat.reduce((s, a) => s + a.score, 0);
    const total = inCat.reduce((s, a) => s + a.maxScore, 0);
    weighted += (earned / total) * 100 * cat.weight;
    wsum += cat.weight;
  }
  if (wsum === 0) {
    // no category match — fall back to flat points
    const earned = valid.reduce((s, a) => s + a.score, 0);
    const total = valid.reduce((s, a) => s + a.maxScore, 0);
    return (earned / total) * 100;
  }
  return weighted / wsum;
}

export type Category = { name: string; weight: number };
export type QuarterData = {
  assignments: Assignment[]; categories: Category[]; weightsGuessed?: boolean;
  weightsCustom?: boolean; officialCategories?: Category[];
};

// One quarter's assignments + weights for a class. Newer imports store them per quarter in
// cls.quarters[term]; older imports kept only the latest quarter at the top level.
export function quarterFor(cls: any, term: string | undefined): QuarterData | null {
  if (!cls || !term) return null;
  const q = cls.quarters?.[term];
  if (q && Array.isArray(q.assignments)) {
    return {
      assignments: q.assignments, categories: q.categories?.length ? q.categories : cls.categories ?? [],
      weightsGuessed: q.weightsGuessed, weightsCustom: q.weightsCustom, officialCategories: q.officialCategories,
    };
  }
  if (cls.assignmentsTerm === term && Array.isArray(cls.assignments)) {
    return { assignments: cls.assignments, categories: cls.categories ?? [], weightsGuessed: cls.weightsGuessed };
  }
  return null;
}

// Exact grade for a quarter, calculated from its assignments (Skyward rounds its term grades)
export function exactGrade(cls: any, term: string): number | null {
  const q = quarterFor(cls, term);
  if (!q || q.assignments.length === 0 || q.categories.length === 0) return null;
  return calcGrade(q.assignments, q.categories);
}

// Change in a term's official grade since the previous import (null when unchanged or new)
export function changeSinceLastImport(cls: any, term: string): number | null {
  const now = cls?.terms?.[term], before = cls?.prevTerms?.[term];
  if (typeof now !== "number" || typeof before !== "number") return null;
  const d = Math.round((now - before) * 100) / 100;
  return d === 0 ? null : d;
}

// ── Semesters ──────────────────────────────────────────────────────────────
export const SEMESTER_QUARTERS: Record<string, [string, string]> = { SM1: ["MP1", "MP2"], SM2: ["MP3", "MP4"] };
const SEMESTER_EXAM: Record<string, string> = { SM1: "EX1", SM2: "EX2" };

// Exact quarter grade when assignments are imported, otherwise Skyward's rounded grade
export function quarterGrade(cls: any, term: string): number | null {
  return exactGrade(cls, term) ?? (typeof cls?.terms?.[term] === "number" ? cls.terms[term] : null);
}

// Semester grade from its two quarters (+ exam), using the district split: each quarter 42.5%,
// exam 15% (editable per class in semesterConfig). No exam yet / exempt → average of the quarters.
export function semesterGrade(cls: any, sem: string) {
  const [qa, qb] = SEMESTER_QUARTERS[sem];
  const a = quarterGrade(cls, qa), b = quarterGrade(cls, qb);
  const examRaw = cls?.terms?.[SEMESTER_EXAM[sem]];
  const exam = typeof examRaw === "number" ? examRaw : null;
  const mpW = cls?.semesterConfig?.mpWeight ?? 42.5;
  const exW = cls?.semesterConfig?.finalWeight ?? 15;
  const exempt = !!cls?.semesterConfig?.exempt;
  let grade: number | null = null;
  if (a != null && b != null) {
    grade = exam != null && !exempt ? (a * mpW + b * mpW + exam * exW) / (2 * mpW + exW) : (a + b) / 2;
  } else {
    grade = a ?? b; // only one quarter so far
  }
  return { grade, quarters: [[qa, a], [qb, b]] as [string, number | null][], exam, mpW, exW, exempt };
}

// All assignments from a semester's quarters, each tagged with its quarter
export function semesterAssignments(cls: any, sem: string) {
  return SEMESTER_QUARTERS[sem].flatMap((t) =>
    (quarterFor(cls, t)?.assignments ?? []).map((a) => ({ ...a, quarter: t }))
  );
}

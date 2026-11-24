import { getDoc, setDoc } from "firebase/firestore";
import { userDoc } from "../firebase/userCollection";

// Grades sent by the OnTrack browser extension (extension/popup.js) arrive in the link's
// #grades=… fragment. public/index.html moves them into sessionStorage before the app loads,
// so they survive the sign-in redirect and never appear in the address bar or server logs.

export const PENDING_KEY = "ontrackPendingGrades";

export type ImportedAssignment = { name: string; category: string | null; due: string | null; score?: number; maxScore?: number };
export type ImportedClass = {
  name: string; year: string; terms: Record<string, number>;
  source: string; // which gradebook it came from: "skyward" (now) or "hac" (later)
  assignments?: { term: string; categories: string[]; items: ImportedAssignment[]; weights?: { name: string; weight: number }[] };
  // Per-quarter assignments (newer extension versions): MP1…MP4 → that quarter's data
  quarters?: Record<string, { categories: string[]; items: ImportedAssignment[]; weights?: { name: string; weight: number }[] }>;
};

const cleanText = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined);

function decodeAssignments(raw: any): ImportedClass["assignments"] | undefined {
  if (!raw || typeof raw !== "object" || !TERM_KEYS.has(raw.term) || !Array.isArray(raw.items)) return undefined;
  const categories = (Array.isArray(raw.categories) ? raw.categories : []).map((c: unknown) => cleanText(c, 60)).filter(Boolean).slice(0, 20);
  const items: ImportedAssignment[] = [];
  for (const a of raw.items.slice(0, 200)) {
    const name = cleanText(a?.name, 100);
    if (!name) continue;
    const item: ImportedAssignment = {
      name,
      category: cleanText(a.category, 60) || null,
      due: /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(a.due ?? "") ? a.due : null,
    };
    const score = num(a.score, 10000), maxScore = num(a.maxScore, 10000);
    if (score !== undefined && maxScore !== undefined && maxScore > 0) { item.score = score; item.maxScore = maxScore; }
    items.push(item);
  }
  // Real category weights from Skyward's "Calculations" dialog, when available
  const weights = (Array.isArray(raw.weights) ? raw.weights : [])
    .map((w: any) => ({ name: cleanText(w?.name, 60), weight: num(w?.weight, 100) }))
    .filter((w: { name: string; weight?: number }) => w.name && w.weight !== undefined)
    .slice(0, 20) as { name: string; weight: number }[];
  return { term: raw.term, categories, items, ...(weights.length ? { weights } : {}) };
}

const TERM_KEYS = new Set(["MP1", "MP2", "MP3", "MP4", "EX1", "EX2", "SM1", "SM2"]);

// School years run Aug–Jul: October 2026 → "2026-2027"
export function currentSchoolYear(now = new Date()) {
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

export function getPendingImport(): string | null {
  try { return typeof sessionStorage !== "undefined" ? sessionStorage.getItem(PENDING_KEY) : null; } catch { return null; }
}

export function clearPendingImport() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch {}
}

// Decode + validate. Everything in the link is untrusted, so only well-formed values survive.
export function decodeImport(encoded: string): ImportedClass[] {
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || data.v !== 1 || !Array.isArray(data.classes)) throw new Error("Unrecognized import");

  const fallbackYear = currentSchoolYear();
  const source = ["skyward", "hac"].includes(data.source) ? data.source : "unknown";
  const out: ImportedClass[] = [];
  for (const c of data.classes.slice(0, 150)) {
    if (!c || typeof c.name !== "string") continue;
    const name = c.name.replace(/\s+/g, " ").trim().slice(0, 100);
    if (name.length < 2) continue;
    const terms: Record<string, number> = {};
    for (const [k, v] of Object.entries(c.terms ?? {})) {
      if (TERM_KEYS.has(k) && typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 150) terms[k] = v;
    }
    if (Object.keys(terms).length === 0) continue;
    const year = typeof c.year === "string" && /^\d{4}-\d{4}$/.test(c.year) ? c.year : fallbackYear;
    const assignments = decodeAssignments(c.assignments);
    const quarters: NonNullable<ImportedClass["quarters"]> = {};
    if (c.quarters && typeof c.quarters === "object") {
      for (const t of ["MP1", "MP2", "MP3", "MP4"]) {
        const q = decodeAssignments(c.quarters[t] ? { ...c.quarters[t], term: t } : null);
        if (q) quarters[t] = { categories: q.categories, items: q.items, ...(q.weights ? { weights: q.weights } : {}) };
      }
    }
    if (assignments && !quarters[assignments.term]) quarters[assignments.term] = assignments; // older extension
    out.push({ name, year, terms, source, ...(Object.keys(quarters).length ? { quarters } : {}) });
  }
  return out;
}

const docId = (year: string, name: string) => `${year}_${name}`.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60);

// Save to users/{uid}/grades. New term grades replace old ones; your own settings for a class
// (weights, AP/Honors override, exam calculator) are kept.
export async function saveImport(classes: ImportedClass[]) {
  const now = new Date().toISOString();
  await Promise.all(classes.map(async (c) => {
    const ref = userDoc("grades", docId(c.year, c.name));
    const prev = await getDoc(ref);
    const prevTerms = prev.exists() ? prev.get("terms") ?? {} : {};
    const update: Record<string, unknown> = { name: c.name, year: c.year, terms: { ...prevTerms, ...c.terms }, source: c.source, updatedAt: now };
    // Grades as they were before this import, so screens can show "+1" / "−5" since last time
    if (prev.exists()) update.prevTerms = prevTerms;
    if (c.quarters) {
      const prevQuarters = prev.exists() ? prev.get("quarters") ?? {} : {};
      const quarters: Record<string, unknown> = {};
      for (const [t, q] of Object.entries(c.quarters)) {
        const assignments = q.items.map((a) => ({
          name: a.name, category: a.category ?? "Other", due: a.due,
          ...(a.maxScore ? { score: a.score, maxScore: a.maxScore } : { score: 0, maxScore: 0 }),
        }));
        let categories: { name: string; weight: number }[];
        let weightsGuessed = false;
        const prevQ = prevQuarters[t] ?? {};
        if (prevQ.weightsCustom && Array.isArray(prevQ.categories) && prevQ.categories.length) {
          categories = prevQ.categories; // the student changed these — keep their weights
        } else if (q.weights?.length) {
          categories = q.weights; // official weights from the gradebook (Skyward: Calculations dialog)
        } else {
          // No official weights: keep what the student set for this quarter if the categories match,
          // otherwise split evenly and ask them to check
          const prevCats: { name: string; weight: number }[] = prevQuarters[t]?.categories ?? [];
          const same = prevCats.length === q.categories.length && q.categories.every((n) => prevCats.some((p) => p.name.toLowerCase() === n.toLowerCase()));
          const even = q.categories.length ? Math.round((100 / q.categories.length) * 10) / 10 : 0;
          categories = same ? prevCats : q.categories.map((name) => ({ name, weight: even }));
          weightsGuessed = !same && q.categories.length > 0;
        }
        quarters[t] = {
          assignments, categories, weightsGuessed,
          weightsCustom: !!prevQ.weightsCustom,
          // Kept so "Use official weights" can switch back after the student edits them
          ...(q.weights?.length ? { officialCategories: q.weights } : prevQ.officialCategories ? { officialCategories: prevQ.officialCategories } : {}),
        };
      }
      update.quarters = quarters; // merged with quarters saved earlier (setDoc merge)
    }
    await setDoc(ref, update, { merge: true });
  }));
}

export const TERM_LABELS: Record<string, string> = {
  MP1: "Q1", MP2: "Q2", EX1: "Exam 1", SM1: "Sem 1", MP3: "Q3", MP4: "Q4", EX2: "Exam 2", SM2: "Sem 2",
};

// Weighted-grade multipliers (a common Texas district scale)
export type WeightClass = "ap" | "dual" | "onramps" | "honors" | "regular";

export const WEIGHT_MULTIPLIERS: Record<WeightClass, number> = {
  ap: 1.15,       // Advanced Placement
  dual: 1.15,     // Dual credit
  onramps: 1.15,  // OnRamps
  honors: 1.08,   // Honors
  regular: 1.0,   // Regular / on-level
};

export const WEIGHT_LABELS: Record<WeightClass, string> = {
  ap: "AP",
  dual: "Dual",
  onramps: "OnRamps",
  honors: "Honors",
  regular: "Reg",
};

// Guess a class's weight category from its name.
export function classifyClass(name: string): WeightClass {
  const n = (name || "").toLowerCase();
  if (/\bon[\s-]?ramps?\b/.test(n)) return "onramps";
  if (/\bdual\b|\bdc\b|dual credit/.test(n)) return "dual";
  if (/\bap\b|advanced placement/.test(n)) return "ap";
  if (/honors?|\bhon\b/.test(n) && !/\bap\b/.test(n)) return "honors";
  return "regular";
}

// A class doc may carry a manual `weightClass` override; otherwise auto-classify.
export function weightClassFor(cls: { name?: string; weightClass?: WeightClass }): WeightClass {
  return cls.weightClass ?? classifyClass(cls.name ?? "");
}

// A class may also carry a custom `multiplier` (districts use different boosts)
export function multiplierFor(cls: { name?: string; weightClass?: WeightClass; multiplier?: number }): number {
  if (typeof cls.multiplier === "number" && cls.multiplier >= 1 && cls.multiplier <= 2) return cls.multiplier;
  return WEIGHT_MULTIPLIERS[weightClassFor(cls)];
}

export const WEIGHT_CLASSES: WeightClass[] = ["ap", "dual", "onramps", "honors", "regular"];
export const WEIGHT_FULL_LABELS: Record<WeightClass, string> = {
  ap: "AP", dual: "Dual Credit", onramps: "OnRamps", honors: "Honors", regular: "Regular",
};

// Unweighted average of a set of {grade} for a given term.
export function unweightedAverage(grades: number[]): number | null {
  if (grades.length === 0) return null;
  return grades.reduce((s, g) => s + g, 0) / grades.length;
}

// Weighted average: each grade × its class multiplier, then averaged.
// (weighted values can exceed 100.)
export function weightedAverage(items: { grade: number; cls: { name?: string; weightClass?: WeightClass } }[]): number | null {
  if (items.length === 0) return null;
  const total = items.reduce((s, it) => s + it.grade * multiplierFor(it.cls), 0);
  return total / items.length;
}

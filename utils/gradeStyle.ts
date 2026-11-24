// Shared look for grades: letter + color by percentage (used by Grades, class and import screens)

export function letterFor(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

const COLORS: Record<string, string> = {
  A: "#2ecc71",
  B: "#3fa9f5",
  C: "#f5a623",
  D: "#f0703c",
  F: "#e5484d",
};

export function gradeTint(pct: number): string {
  return COLORS[letterFor(pct)];
}

// Soft background behind a grade (tint at ~15% opacity)
export function gradeBg(pct: number): string {
  return gradeTint(pct) + "26";
}

// "98.7" for most grades, "100" when whole
export function fmtGrade(pct: number, digits = 1): string {
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(digits);
}

// "AP ENG IV LIT" → "AP Eng IV Lit" (keeps short all-caps words like AP, IV, US)
export function titleCase(name: string): string {
  return (name || "").split(" ").map((w) =>
    w.length <= 2 || /^(AP|IB|US|IV|VI|II|III|DC|PE|CTE|STEM)$/.test(w) || !/^[A-Z/&-]+$/.test(w)
      ? w
      : w[0] + w.slice(1).toLowerCase()
  ).join(" ");
}

// Where grades came from, as a student-facing name. Grades can come from different gradebooks
// (Skyward now, HAC later), so screens use neutral wording plus this when the source matters.
export function sourceName(source?: string): string {
  return ({ skyward: "Skyward", hac: "HAC" } as Record<string, string>)[source ?? ""] ?? "your gradebook";
}

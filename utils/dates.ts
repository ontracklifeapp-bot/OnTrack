// Shared date helpers. Due dates are stored as text like "October 6, 2026",
// which Hermes (the phone JS engine) can't parse with `new Date()`.

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

export function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\w+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (m) {
    const idx = MONTH_MAP[m[1].toLowerCase()];
    if (idx !== undefined) return new Date(parseInt(m[3]), idx, parseInt(m[2]));
  }
  // Fallback: ISO strings etc.
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// "2026-10-06" in the user's local time zone (toISOString would use UTC)
export function toLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getDaysUntil(dateStr: string | undefined | null): number {
  const d = parseDate(dateStr);
  if (!d) return NaN;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

// ── Repeats ─────────────────────────────────────────────────────────────────
// Tasks store "1 week" / "3 months"; bills store "Monthly" / "Quarterly";
// "Custom" lets people type things like "every 2 weeks".

type Unit = "day" | "week" | "month" | "year";
type Repeat = { n: number; unit: Unit };

const NAMED: Record<string, Repeat | null> = {
  daily: { n: 1, unit: "day" },
  weekly: { n: 1, unit: "week" },
  biweekly: { n: 2, unit: "week" },
  fortnightly: { n: 2, unit: "week" },
  monthly: { n: 1, unit: "month" },
  quarterly: { n: 3, unit: "month" },
  yearly: { n: 1, unit: "year" },
  annually: { n: 1, unit: "year" },
  "one-time": null,
  once: null,
};

export function parseRepeat(text: string | undefined | null): Repeat | null {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  if (t in NAMED) return NAMED[t];
  const m = t.match(/(\d+|other)?\s*(day|week|month|year)s?/);
  if (!m) return null;
  const n = m[1] === "other" ? 2 : m[1] ? parseInt(m[1]) : 1;
  return n > 0 ? { n, unit: m[2] as Unit } : null;
}

export function advanceDate(date: Date, rep: Repeat): Date {
  const d = new Date(date);
  if (rep.unit === "day") d.setDate(d.getDate() + rep.n);
  else if (rep.unit === "week") d.setDate(d.getDate() + 7 * rep.n);
  else {
    // Months/years: keep the same day, clamped to month length (Jan 31 → Feb 28, not Mar 3)
    const months = rep.unit === "year" ? 12 * rep.n : rep.n;
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return d;
}

export function getNextDueDate(dueDateStr: string, repeat: string | undefined): Date | null {
  const d = parseDate(dueDateStr);
  const rep = parseRepeat(repeat);
  if (!d || !rep) return null;
  return advanceDate(d, rep);
}

// Text for the card subtitle: "Monthly", "every 2 weeks", or "" for one-off items
export function repeatLabel(repeat: string | undefined | null): string {
  if (!repeat || !parseRepeat(repeat)) return "";
  const t = repeat.trim();
  if (t.toLowerCase() in NAMED) return t;
  return /^every\b/i.test(t) ? t : `every ${t}`;
}

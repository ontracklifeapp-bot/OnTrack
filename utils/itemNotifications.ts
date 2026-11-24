import { getDocs } from "firebase/firestore";
import { userCol } from "../firebase/userCollection";
import { parseDate } from "./dates";
import { cancelNotification, scheduleNotification } from "./notifications";

// One place that decides what each kind of item's reminder says and when it fires.
export type ItemKind = "task" | "bill" | "homework" | "reminder";

const DONE_FIELD: Record<ItemKind, string> = { task: "done", bill: "paid", homework: "done", reminder: "done" };
const COLLECTION: Record<ItemKind, string> = { task: "tasks", bill: "bills", homework: "homework", reminder: "reminders" };

// "3:30 PM" → [15, 30]
function parseTime(t?: string): [number, number] | null {
  const m = t?.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const period = m[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return [h, parseInt(m[2])];
}

export async function scheduleItemNotification(kind: ItemKind, item: any): Promise<void> {
  const date = parseDate(kind === "reminder" ? item.date : item.dueDate);
  if (!date) return;
  if (kind === "reminder") {
    const [h, m] = parseTime(item.time) ?? [9, 0];
    date.setHours(h, m, 0, 0);
    return scheduleNotification(item.id, `${item.icon || "🔔"} Reminder`, item.name, date);
  }
  date.setHours(9, 0, 0, 0);
  if (kind === "task") return scheduleNotification(item.id, `${item.icon} Task Due`, item.name, date);
  if (kind === "bill") return scheduleNotification(item.id, "💳 Bill Due Today", `${item.name} – $${(item.amount || 0).toFixed(2)}`, date);
  return scheduleNotification(item.id, "📚 Homework Due Today", `${item.taskName} – ${item.subject}`, date);
}

// Call when an item is checked off (done = true) or un-checked (done = false)
export async function updateItemNotification(kind: ItemKind, item: any, done: boolean): Promise<void> {
  await cancelNotification(item.id);
  if (!done) await scheduleItemNotification(kind, item);
}

// After reminders are switched back on: schedule every unfinished item again
export async function rescheduleAllNotifications(): Promise<void> {
  for (const kind of Object.keys(COLLECTION) as ItemKind[]) {
    const snap = await getDocs(userCol(COLLECTION[kind]));
    for (const d of snap.docs) {
      const item = { id: d.id, ...d.data() } as any;
      if (!item[DONE_FIELD[kind]]) await scheduleItemNotification(kind, item);
    }
  }
}

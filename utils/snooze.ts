import { updateDoc } from "firebase/firestore";
import { userDoc } from "../firebase/userCollection";
import { formatDate } from "./dates";
import { ItemKind, scheduleItemNotification } from "./itemNotifications";
import { cancelNotification } from "./notifications";

const COLLECTION: Record<ItemKind, string> = { task: "tasks", bill: "bills", homework: "homework", reminder: "reminders" };
const DATE_FIELD: Record<ItemKind, string> = { task: "dueDate", bill: "dueDate", homework: "dueDate", reminder: "date" };

export function dateFieldFor(kind: ItemKind) {
  return DATE_FIELD[kind];
}

// Move an item to a new date (keeps its phone reminder in step). Returns the old date text for Undo.
export async function moveItemToDate(kind: ItemKind, item: any, date: Date | string): Promise<string> {
  const field = DATE_FIELD[kind];
  const old = item[field];
  const value = typeof date === "string" ? date : formatDate(date);
  await updateDoc(userDoc(COLLECTION[kind], item.id), { [field]: value });
  await cancelNotification(item.id);
  await scheduleItemNotification(kind, { ...item, [field]: value });
  return old;
}

// Snooze choices, counted from today (not from the old due date)
export function snoozeDate(choice: "tomorrow" | "3days" | "week"): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (choice === "tomorrow" ? 1 : choice === "3days" ? 3 : 7));
  return d;
}

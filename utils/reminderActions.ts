import { updateDoc } from "firebase/firestore";
import { userDoc } from "../firebase/userCollection";
import { formatDate, getNextDueDate } from "./dates";
import { scheduleItemNotification, updateItemNotification } from "./itemNotifications";
import { cancelNotification } from "./notifications";

// Check a reminder off — or, if it repeats, move it to its next date instead.
export async function setReminderDone(r: any, done: boolean) {
  const next = done && r.repeat && r.date ? getNextDueDate(r.date, r.repeat) : null;
  if (next) {
    await updateDoc(userDoc("reminders", r.id), { done: false, date: formatDate(next) });
    await cancelNotification(r.id);
    await scheduleItemNotification("reminder", { ...r, date: formatDate(next) });
    return;
  }
  await updateDoc(userDoc("reminders", r.id), { done });
  await updateItemNotification("reminder", r, done);
}

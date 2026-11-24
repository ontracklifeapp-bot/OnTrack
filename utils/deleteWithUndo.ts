import { deleteDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { userCol, userDoc } from "../firebase/userCollection";
import { ItemKind, scheduleItemNotification } from "./itemNotifications";
import { cancelNotification } from "./notifications";

const COLLECTION: Record<ItemKind, string> = { task: "tasks", bill: "bills", homework: "homework", reminder: "reminders" };
const DONE_FIELD: Record<ItemKind, string> = { task: "done", bill: "paid", homework: "done", reminder: "done" };

// Deletes an item right away and shows "Deleted · Undo"; Undo writes the same
// document back (same id) and restores its reminder. Deleting a bill also removes
// its payment history (so it stops counting toward "This month"); Undo restores that too.
export async function deleteWithUndo(
  kind: ItemKind,
  item: any,
  showToast: (msg: string, action?: { label: string; onPress: () => void }) => void
) {
  const { id, ...data } = item;

  let payments: { id: string; data: any }[] = [];
  if (kind === "bill") {
    const snap = await getDocs(query(userCol("payments"), where("billId", "==", id)));
    payments = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  await deleteDoc(userDoc(COLLECTION[kind], id));
  await cancelNotification(id);
  showToast("Deleted", {
    label: "Undo",
    onPress: async () => {
      await setDoc(userDoc(COLLECTION[kind], id), data);
      await Promise.all(payments.map((p) => setDoc(userDoc("payments", p.id), p.data)));
      if (!data[DONE_FIELD[kind]]) await scheduleItemNotification(kind, item);
    },
  });
}

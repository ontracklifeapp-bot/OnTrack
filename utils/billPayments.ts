import { addDoc, deleteDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { userCol, userDoc } from "../firebase/userCollection";
import { formatDate, getNextDueDate, parseDate, toLocalISO } from "./dates";
import { scheduleItemNotification, updateItemNotification } from "./itemNotifications";
import { cancelNotification } from "./notifications";

// Payments are kept in users/{uid}/payments so "This month" can show what was
// paid even after a repeating bill has moved on to its next due date.
export type Payment = { id: string; billId: string; name: string; amount: number; periodDue: string; paidOn: string };

async function recordPayment(bill: any) {
  await addDoc(userCol("payments"), {
    billId: bill.id,
    name: bill.name,
    amount: bill.amount || 0,
    periodDue: bill.dueDate, // which bill period this payment was for
    paidOn: toLocalISO(new Date()),
    createdAt: new Date(),
  });
}

async function removePayment(bill: any) {
  const snap = await getDocs(query(userCol("payments"), where("billId", "==", bill.id), where("periodDue", "==", bill.dueDate)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

// Mark a bill paid (or un-paid). Repeating bills record the payment and move to their next date.
export async function setBillPaid(bill: any, paid: boolean) {
  if (paid) {
    await recordPayment(bill);
    const next = bill.repeat && bill.dueDate ? getNextDueDate(bill.dueDate, bill.repeat) : null;
    if (next) {
      await updateDoc(userDoc("bills", bill.id), { paid: false, dueDate: formatDate(next) });
      await cancelNotification(bill.id);
      await scheduleItemNotification("bill", { ...bill, dueDate: formatDate(next) });
      return;
    }
  } else {
    await removePayment(bill);
  }
  await updateDoc(userDoc("bills", bill.id), { paid });
  await updateItemNotification("bill", bill, paid);
}

// Totals for the current month: what's been paid, and what's still owed
// (unpaid bills due this month, plus any overdue ones from earlier months).
export function monthTotals(bills: any[], payments: Payment[], now = new Date()) {
  const monthKey = toLocalISO(now).slice(0, 7); // "2026-10"
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const inThisMonth = (d: Date | null) => !!d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

  let paid = payments.filter((p) => p.paidOn?.startsWith(monthKey)).reduce((s, p) => s + (p.amount || 0), 0);
  // One-time bills marked paid before payment history existed have no payment record
  for (const b of bills) {
    if (b.paid && inThisMonth(parseDate(b.dueDate)) && !payments.some((p) => p.billId === b.id && p.periodDue === b.dueDate)) {
      paid += b.amount || 0;
    }
  }
  const remaining = bills
    .filter((b) => { const d = parseDate(b.dueDate); return !b.paid && !!d && d <= endOfMonth; })
    .reduce((s, b) => s + (b.amount || 0), 0);
  return { paid, remaining, total: paid + remaining };
}

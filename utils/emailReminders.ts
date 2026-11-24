import { doc, getDoc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebase/firebase";

// The daily email is sent by the dailyReminders Cloud Function (functions/index.js)
// to everyone whose users/{uid} doc has emailReminders: true, at 7am in their timeZone.

const settingsDoc = () => doc(db, "users", auth.currentUser!.uid);

export async function getEmailReminders(): Promise<boolean> {
  const snap = await getDoc(settingsDoc());
  return snap.exists() && snap.get("emailReminders") === true;
}

export async function setEmailReminders(enabled: boolean): Promise<void> {
  await setDoc(
    settingsDoc(),
    { emailReminders: enabled, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    { merge: true }
  );
}

export async function sendTestEmail(): Promise<void> {
  await httpsCallable(functions, "sendTestReminder")();
}

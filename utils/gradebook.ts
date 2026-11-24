import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase/firebase";

// Which gradebook the student's school district uses. Saved on users/{uid} so it follows the
// student across devices. Skyward is supported by the extension now; HAC is coming.
export type Gradebook = "skyward" | "hac";

export const GRADEBOOKS: { id: Gradebook; name: string; full: string; ready: boolean }[] = [
  { id: "skyward", name: "Skyward", full: "Skyward Family Access", ready: true },
  { id: "hac", name: "HAC", full: "Home Access Center (HAC)", ready: false },
];

export function gradebookInfo(id?: string | null) {
  return GRADEBOOKS.find((g) => g.id === id) ?? null;
}

// undefined = still loading, null = not chosen yet
export function useGradebook(): [Gradebook | null | undefined, (g: Gradebook) => Promise<void>] {
  const [value, setValue] = useState<Gradebook | null | undefined>(undefined);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setValue(null); return; }
    return onSnapshot(doc(db, "users", uid), (snap) => {
      const g = snap.exists() ? snap.get("gradebook") : null;
      setValue(g === "skyward" || g === "hac" ? g : null);
    }, () => setValue(null));
  }, []);
  const save = async (g: Gradebook) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setValue(g);
    await setDoc(doc(db, "users", uid), { gradebook: g }, { merge: true });
  };
  return [value, save];
}

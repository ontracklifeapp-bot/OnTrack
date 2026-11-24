import { collection, doc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Returns a Firestore collection scoped to the current user
export const userCol = (name: string) =>
  collection(db, "users", auth.currentUser!.uid, name);

// Returns a Firestore document reference scoped to the current user
export const userDoc = (colName: string, docId: string) =>
  doc(db, "users", auth.currentUser!.uid, colName, docId);

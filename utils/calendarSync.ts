import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebase/firebase";

// Private calendar feed served by the calendarFeed Cloud Function (functions/index.js)
const FEED_BASE = "https://ontracklife.app/ical/";

export async function getExistingCalendarLink(): Promise<string | null> {
  const snap = await getDoc(doc(db, "users", auth.currentUser!.uid));
  const token = snap.exists() ? snap.get("calendarToken") : null;
  return token ? `${FEED_BASE}${token}.ics` : null;
}

export async function createCalendarLink(): Promise<string> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const res = await httpsCallable<{ timeZone: string }, { url: string }>(functions, "getCalendarLink")({ timeZone });
  return res.data.url;
}

export async function resetCalendarLink(): Promise<string> {
  const res = await httpsCallable<void, { url: string }>(functions, "resetCalendarLink")();
  return res.data.url;
}

// One-click subscribe links
export const webcalUrl = (url: string) => url.replace(/^https:/, "webcal:");
export const googleCalendarUrl = (url: string) =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(url))}`;

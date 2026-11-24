// OnTrack server code (Firebase Cloud Functions).
//
// dailyReminders  — runs every hour; at 7am in each opted-in user's time zone it
//                   emails them what's overdue / due today / due tomorrow.
// sendTestReminder — lets a signed-in user send that email to themselves now.
//
// Emails are sent from ontrack.lifeapp@gmail.com using a Gmail app password stored
// in Secret Manager (set with: npx firebase functions:secrets:set GMAIL_APP_PASSWORD).
// They always go to the address on the user's Firebase account, never to an address
// supplied by the client, so this can't be used to email strangers.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

const GMAIL_USER = "ontrack.lifeapp@gmail.com";
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
const SITE_URL = "https://ontracklife.app";
const SEND_HOUR = 7; // local time
const DEFAULT_TZ = "America/Chicago";

// ── Dates ────────────────────────────────────────────────────────────────────
// Due dates are stored as text like "October 6, 2026".
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function parseYMD(str) {
  if (!str) return null;
  const m = String(str).match(/^(\w+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (m) {
    const mo = MONTHS.indexOf(m[1].toLowerCase());
    if (mo >= 0) return [parseInt(m[3]), mo, parseInt(m[2])];
  }
  const iso = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? [parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3])] : null;
}

function validTimeZone(tz) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return DEFAULT_TZ; }
}

// Today's [year, month, day] and the current hour in a time zone
function nowIn(tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23" })
      .formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return { ymd: [parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day)], hour: parseInt(parts.hour) };
}

function daysUntil(dueStr, todayYMD) {
  const d = parseYMD(dueStr);
  if (!d) return null;
  return Math.round((Date.UTC(d[0], d[1], d[2]) - Date.UTC(...todayYMD)) / 86400000);
}

// ── Building the email ───────────────────────────────────────────────────────
async function collectDue(uid, todayYMD) {
  const sources = [
    { col: "tasks", done: "done", date: "dueDate", label: (x) => `${x.icon || "✅"} ${x.name}` },
    { col: "bills", done: "paid", date: "dueDate", label: (x) => `💳 ${x.name} ($${Number(x.amount || 0).toFixed(2)})` },
    { col: "homework", done: "done", date: "dueDate", label: (x) => `📚 ${x.taskName}${x.subject ? ` (${x.subject})` : ""}` },
    { col: "reminders", done: "done", date: "date", label: (x) => `${x.icon || "🔔"} ${x.name}${x.time ? ` at ${x.time}` : ""}` },
  ];
  const overdue = [], today = [], tomorrow = [];
  for (const s of sources) {
    const snap = await db.collection("users").doc(uid).collection(s.col).get();
    for (const doc of snap.docs) {
      const x = doc.data();
      if (x[s.done]) continue;
      const days = daysUntil(x[s.date], todayYMD);
      if (days === null) continue;
      if (days < 0) overdue.push({ text: s.label(x), days });
      else if (days === 0) today.push({ text: s.label(x) });
      else if (days === 1) tomorrow.push({ text: s.label(x) });
    }
  }
  overdue.sort((a, b) => a.days - b.days);
  return { overdue, today, tomorrow };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function buildEmail(name, due) {
  const total = due.overdue.length + due.today.length + due.tomorrow.length;
  const subject = total === 0
    ? "OnTrack: nothing due today 🎉"
    : `OnTrack: ${total} thing${total === 1 ? "" : "s"} to take care of`;

  const section = (title, color, items, withDays) => items.length === 0 ? "" : `
    <h3 style="margin:20px 0 8px;font-size:15px;color:${color}">${title}</h3>
    <ul style="margin:0;padding-left:20px;line-height:1.7">
      ${items.map((i) => `<li>${esc(i.text)}${withDays ? ` <span style="color:#888">(${-i.days} day${i.days === -1 ? "" : "s"} overdue)</span>` : ""}</li>`).join("")}
    </ul>`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#222">
    <h2 style="margin:0 0 4px;color:#6C63FF">OnTrack</h2>
    <p style="margin:0 0 8px">Good morning${name ? `, ${esc(name)}` : ""}!</p>
    ${total === 0 ? `<p>Nothing is due today or tomorrow. Enjoy the break!</p>` : ""}
    ${section("🚨 Overdue", "#e74c3c", due.overdue, true)}
    ${section("📅 Due today", "#e67e22", due.today)}
    ${section("🔜 Due tomorrow", "#6C63FF", due.tomorrow)}
    <p style="margin:28px 0 0"><a href="${SITE_URL}" style="background:#6C63FF;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">Open OnTrack</a></p>
    <p style="margin:28px 0 0;font-size:12px;color:#888">You're getting this because you turned on the daily email summary.
      To stop, open OnTrack → Settings and turn off “Daily email summary”.</p>
  </div>`;

  const text = [
    `Good morning${name ? `, ${name}` : ""}!`,
    total === 0 ? "Nothing is due today or tomorrow." : "",
    ...due.overdue.map((i) => `OVERDUE: ${i.text} (${-i.days} days)`),
    ...due.today.map((i) => `TODAY: ${i.text}`),
    ...due.tomorrow.map((i) => `TOMORROW: ${i.text}`),
    "",
    `Open OnTrack: ${SITE_URL}`,
    "To stop these emails, turn off “Daily email summary” in OnTrack Settings.",
  ].filter((l) => l !== "").join("\n");

  return { subject, html, text };
}

function mailer() {
  return nodemailer.createTransport({
    service: "gmail",
    // Google shows app passwords as "abcd efgh ijkl mnop"; strip the spaces however it was pasted
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.value().replace(/\s+/g, "") },
  });
}

async function sendDigest(transport, uid, { force = false } = {}) {
  const user = await admin.auth().getUser(uid);
  if (!user.email) return "no-email";
  // Only email confirmed addresses (protects the sender from bounces / spam flags)
  if (!user.emailVerified) return "unverified";
  const settings = (await db.collection("users").doc(uid).get()).data() || {};
  const { ymd } = nowIn(validTimeZone(settings.timeZone));
  const due = await collectDue(uid, ymd);
  const total = due.overdue.length + due.today.length + due.tomorrow.length;
  if (total === 0 && !force) return "nothing-due";
  const { subject, html, text } = buildEmail((user.displayName || "").split(" ")[0], due);
  await transport.sendMail({ from: `OnTrack <${GMAIL_USER}>`, to: user.email, subject, html, text });
  return "sent";
}

// ── Hourly: send at 7am local time to everyone who opted in ──────────────────
exports.dailyReminders = onSchedule(
  { schedule: "every 1 hours", timeZone: "UTC", secrets: [GMAIL_APP_PASSWORD], timeoutSeconds: 300 },
  async () => {
    const optedIn = await db.collection("users").where("emailReminders", "==", true).get();
    const transport = mailer();
    let sent = 0;
    for (const doc of optedIn.docs) {
      const { hour, ymd } = nowIn(validTimeZone(doc.get("timeZone")));
      const todayKey = `${ymd[0]}-${ymd[1] + 1}-${ymd[2]}`; // e.g. "2026-10-19"
      // Only at 7am local, and never twice on the same local day
      if (hour !== SEND_HOUR || doc.get("lastSentDay") === todayKey) continue;
      try {
        const result = await sendDigest(transport, doc.id);
        await doc.ref.set({ lastSentDay: todayKey }, { merge: true });
        if (result === "sent") sent++;
      } catch (e) {
        logger.error("Reminder failed", { uid: doc.id, error: e.message });
      }
    }
    logger.info(`dailyReminders: checked ${optedIn.size}, sent ${sent}`);
  }
);

// ── On demand: "Send me a test email" in Settings ────────────────────────────
exports.sendTestReminder = onCall({ secrets: [GMAIL_APP_PASSWORD] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");

  // At most one test email per minute per user
  const ref = db.collection("users").doc(uid);
  const last = (await ref.get()).get("lastTestAt") || 0;
  if (Date.now() - last < 60000) throw new HttpsError("resource-exhausted", "Wait a minute before sending another test email.");
  await ref.set({ lastTestAt: Date.now() }, { merge: true });

  const result = await sendDigest(mailer(), uid, { force: true });
  if (result === "no-email") throw new HttpsError("failed-precondition", "Your account has no email address.");
  if (result === "unverified") throw new HttpsError("failed-precondition", "unverified");
  return { ok: true };
});

// ── Calendar sync (subscribe from Google / Apple / Outlook) ──────────────────
// Each user gets a private, unguessable feed URL:
//   https://ontracklife.app/ical/<token>.ics   (Hosting rewrites /ical/** here; old
//   your-project-id.web.app links keep working too)
// calendarTokens/{token} → { uid } is server-only (no client rule allows access).
const crypto = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");

const FEED_BASE = `${SITE_URL}/ical/`;

function newToken() {
  return crypto.randomBytes(24).toString("hex"); // 48 hex chars
}

async function issueToken(uid, { rotate = false } = {}) {
  const userRef = db.collection("users").doc(uid);
  const existing = (await userRef.get()).get("calendarToken");
  if (existing && !rotate) return existing;
  if (existing) await db.collection("calendarTokens").doc(existing).delete();
  const token = newToken();
  await db.collection("calendarTokens").doc(token).set({ uid, createdAt: Date.now() });
  await userRef.set({ calendarToken: token }, { merge: true });
  return token;
}

exports.getCalendarLink = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  // Remember the browser's time zone so timed reminders land at the right hour
  const tz = request.data?.timeZone;
  if (typeof tz === "string" && validTimeZone(tz) === tz) {
    await db.collection("users").doc(uid).set({ timeZone: tz }, { merge: true });
  }
  return { url: `${FEED_BASE}${await issueToken(uid)}.ics` };
});

exports.resetCalendarLink = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  return { url: `${FEED_BASE}${await issueToken(uid, { rotate: true })}.ics` };
});

// Same repeat words the app understands (utils/dates.ts → parseRepeat)
const NAMED_REPEATS = {
  daily: [1, "DAILY"], weekly: [1, "WEEKLY"], biweekly: [2, "WEEKLY"], fortnightly: [2, "WEEKLY"],
  monthly: [1, "MONTHLY"], quarterly: [3, "MONTHLY"], yearly: [1, "YEARLY"], annually: [1, "YEARLY"],
};
function rrule(repeat) {
  if (!repeat) return null;
  const t = String(repeat).trim().toLowerCase();
  if (t === "one-time" || t === "once") return null;
  let n, freq;
  if (NAMED_REPEATS[t]) [n, freq] = NAMED_REPEATS[t];
  else {
    const m = t.match(/(\d+|other)?\s*(day|week|month|year)s?/);
    if (!m) return null;
    n = m[1] === "other" ? 2 : m[1] ? parseInt(m[1]) : 1;
    freq = { day: "DAILY", week: "WEEKLY", month: "MONTHLY", year: "YEARLY" }[m[2]];
  }
  return n > 0 ? `RRULE:FREQ=${freq}${n > 1 ? `;INTERVAL=${n}` : ""}` : null;
}

// iCalendar text rules: escape, and fold lines longer than 75 bytes
const icsText = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line) {
  const out = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) { out.push(cur); cur = ""; }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}
const pad = (n) => String(n).padStart(2, "0");
const ymdStr = ([y, m, d]) => `${y}${pad(m + 1)}${pad(d)}`;
function nextDay([y, m, d]) {
  const t = new Date(Date.UTC(y, m, d + 1));
  return [t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()];
}
function parseTime12(t) {
  const m = String(t || "").match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
  return [h, parseInt(m[2])];
}

async function buildCalendar(uid, tz) {
  const sources = [
    { col: "tasks", done: "done", date: "dueDate", title: (x) => `${x.icon || "✅"} ${x.name}` },
    { col: "bills", done: "paid", date: "dueDate", title: (x) => `💳 ${x.name} – $${Number(x.amount || 0).toFixed(2)}` },
    { col: "homework", done: "done", date: "dueDate", title: (x) => `📚 ${x.taskName}${x.subject ? ` (${x.subject})` : ""}` },
    { col: "reminders", done: "done", date: "date", title: (x) => `${x.icon || "🔔"} ${x.name}` },
  ];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OnTrack//Calendar Sync//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:OnTrack", `X-WR-TIMEZONE:${tz}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const s of sources) {
    const snap = await db.collection("users").doc(uid).collection(s.col).get();
    for (const doc of snap.docs) {
      const x = doc.data();
      if (x[s.done]) continue;
      const ymd = parseYMD(x[s.date]);
      if (!ymd) continue;
      const time = s.col === "reminders" ? parseTime12(x.time) : null;
      // Keep this UID format forever — changing it makes subscribed calendars show duplicates
      lines.push("BEGIN:VEVENT", `UID:${s.col}-${doc.id}@your-project-id.web.app`, `DTSTAMP:${stamp}`);
      if (time) {
        // Timed reminder: local time in the user's zone (calendar apps handle daylight saving)
        const start = `${ymdStr(ymd)}T${pad(time[0])}${pad(time[1])}00`;
        lines.push(`DTSTART;TZID=${tz}:${start}`, "DURATION:PT30M");
      } else {
        lines.push(`DTSTART;VALUE=DATE:${ymdStr(ymd)}`, `DTEND;VALUE=DATE:${ymdStr(nextDay(ymd))}`, "TRANSP:TRANSPARENT");
      }
      const rule = rrule(x.repeat);
      if (rule) lines.push(rule);
      lines.push(`SUMMARY:${icsText(s.title(x))}`);
      lines.push(`DESCRIPTION:${icsText([x.notes, `Open OnTrack: ${SITE_URL}`].filter(Boolean).join("\n\n"))}`);
      lines.push(`URL:${SITE_URL}`, "END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

exports.calendarFeed = onRequest(async (req, res) => {
  const m = req.path.match(/\/ical\/([a-f0-9]{48})\.ics$/);
  if (!m) { res.status(404).send("Not found"); return; }
  const mapping = await db.collection("calendarTokens").doc(m[1]).get();
  if (!mapping.exists) { res.status(404).send("This calendar link was reset or no longer exists."); return; }
  const uid = mapping.get("uid");
  try {
    await admin.auth().getUser(uid);
  } catch {
    await mapping.ref.delete(); // account was deleted — clean up the stale link
    res.status(404).send("Not found");
    return;
  }
  const tz = validTimeZone((await db.collection("users").doc(uid).get()).get("timeZone"));
  const body = await buildCalendar(uid, tz);
  res.set("Content-Type", "text/calendar; charset=utf-8");
  res.set("Cache-Control", "private, max-age=300"); // personal data: never cache on the CDN
  res.send(body);
});

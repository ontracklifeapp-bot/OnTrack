// Popup: if this tab already shows grades, preview them and send. Otherwise, on a Skyward
// page, offer one-click "Update OnTrack", which opens Grading in this tab and sends the grades
// (done by background.js so it keeps going if the popup closes).

const $ = (id) => document.getElementById(id);
// Testing builds have a "send to local test copy" checkbox; the store build removes it
const useLocal = $("useLocal");
if (useLocal) {
  useLocal.checked = localStorage.getItem("useLocal") === "1";
  useLocal.addEventListener("change", () => localStorage.setItem("useLocal", useLocal.checked ? "1" : "0"));
}
const base = () => (useLocal && useLocal.checked ? LOCAL_URL : LIVE_URL);

function status(text, isError) {
  $("status").textContent = text;
  $("status").className = isError ? "error" : "muted";
}

// Latest grade shown for a class (prefers the most recent term that has a value)
function latestGrade(terms) {
  const order = ["EX2", "SM2", "MP4", "MP3", "EX1", "SM1", "MP2", "MP1"];
  const key = order.find((k) => typeof terms[k] === "number");
  return key ? `${terms[key]} (${key.replace("MP", "Q").replace("SM", "S").replace("EX", "Exam ")})` : "";
}

function showPreview(classes, tab) {
  status(`Found ${classes.length} class${classes.length === 1 ? "" : "es"}:`);
  const list = $("preview");
  classes.forEach((c) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = c.name; // textContent: page text is never treated as HTML
    const grade = document.createElement("span");
    grade.textContent = latestGrade(c.terms);
    li.append(name, grade);
    list.append(li);
  });
  list.hidden = false;
  wireSend(tab, "Send to OnTrack", `Getting assignments for ${classes.length} classes…`);
}

function offerUpdate(tab) {
  status("Click below to open your Grading page and send your latest grades and assignments to OnTrack.");
  wireSend(tab, "Update OnTrack", "Opening Grading…");
}

// Both buttons hand off to background.js, which reads grades, visits each class's assignments
// page in this tab, and opens OnTrack. It keeps going even if this popup closes.
function wireSend(tab, label, workingText) {
  const send = $("send");
  send.textContent = label;
  send.hidden = false;
  send.onclick = async () => {
    send.disabled = true;
    // Permission for this Skyward site only (Chrome asks the first time)
    const origin = new URL(tab.url).origin + "/*";
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) {
      send.disabled = false;
      status("OnTrack needs permission for this Skyward site to open Grading for you. Or open Grading yourself and click OnTrack.", true);
      return;
    }
    status(workingText + " Keep this tab open — it takes a few seconds per class.");
    const res = await chrome.runtime.sendMessage({ type: "update", tabId: tab.id, base: base(), forcePastYears: !!($("pastYears") && $("pastYears").checked) });
    if (res && res.ok) window.close();
    else { send.disabled = false; status((res && res.error) || "Something went wrong. Try again.", true); }
  };
}

(async () => {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: site }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: ontrackDetectGradebook });
    if (site === "hac") {
      status("This is Home Access Center (HAC). HAC support is coming soon — for now OnTrack can import from Skyward.", true);
      return;
    }
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: ontrackExtractGrades });
    const classes = (result && result.classes) || [];
    if (classes.length > 0) showPreview(classes, tab);
    else if (result && result.looksLikeSkyward && /^https:/.test(tab.url || "")) offerUpdate(tab);
    else status("Open your school's gradebook (Skyward) and sign in, then click OnTrack.", true);
  } catch {
    // e.g. Chrome's own pages (chrome://…) can't be read by any extension
    status("Open Skyward and sign in, then click OnTrack.", true);
  }
})();

// One-click update: when the student clicks "Update OnTrack" in the popup, take their Skyward
// tab to the Grading page (the same link they'd click), wait for it, read the grades, and open
// OnTrack with them. Runs only in response to that click — never on its own, never in the
// background, never with a password.

importScripts("extract.js", "shared.js");

// Click the visible "Grading" link in Skyward's menu (runs in the Skyward tab)
function ontrackOpenGrading() {
  const candidates = [...document.querySelectorAll("a, button, [role=button], [role=menuitem], [role=tab], li, div, span")]
    .filter((el) => (el.innerText || "").trim() === "Grading" && el.offsetParent !== null);
  // The innermost match is the actual link; prefer real links/buttons
  const el = candidates.find((e) => e.matches("a, button, [role]")) || candidates[candidates.length - 1];
  if (!el) return false;
  el.click();
  return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readGrades(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: ontrackExtractGrades });
    return result;
  } catch {
    return null; // page is mid-navigation
  }
}

// School years run Aug–Jul: October 2026 → "2026-2027" (same rule as the app)
function currentSchoolYear(now = new Date()) {
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

// Past years never change, so Academic History is read once per school year per Skyward site
async function pastYearsNeeded(origin, force) {
  if (force) return true;
  const key = `pastYears:${origin}`;
  const saved = (await chrome.storage.local.get(key))[key];
  return saved !== currentSchoolYear();
}

async function readPastYears(tabId, gradingUrl) {
  const w = gradingUrl.searchParams.get("w"), p = gradingUrl.searchParams.get("p");
  const url = `${gradingUrl.origin}/Student/Grading/StudentSection/AcademicHistoryStudentAccess?w=${encodeURIComponent(w)}&p=${encodeURIComponent(p)}`;
  await chrome.tabs.update(tabId, { url });
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const t = await chrome.tabs.get(tabId);
    if (t.status !== "complete" || !(t.url || "").includes("/AcademicHistoryStudentAccess")) continue;
    const result = await readGrades(tabId);
    if (result && result.classes.length > 0) {
      const thisYear = currentSchoolYear();
      // Only finished years with a year label; this year's grades come from Grading
      return result.classes.filter((c) => c.year && c.year !== thisYear).map(({ reports, ...c }) => c);
    }
  }
  return null;
}

async function updateFromSkyward(tabId, base, forcePastYears) {
  let result = await readGrades(tabId);
  if (!result || result.classes.length === 0) {
    const [{ result: clicked }] = await chrome.scripting.executeScript({ target: { tabId }, func: ontrackOpenGrading });
    if (!clicked) return { ok: false, error: "Couldn't find Skyward's Grading link on this page. Open Grading yourself, then click OnTrack." };
    // Wait up to ~20s for the grades to appear
    for (let i = 0; i < 28; i++) {
      await sleep(700);
      result = await readGrades(tabId);
      if (result && result.classes.length > 0) break;
    }
  }
  if (!result || result.classes.length === 0) {
    return { ok: false, error: "Grading opened, but no grades were found. If Skyward asked you to sign in again, sign in and try once more." };
  }
  const tab = await chrome.tabs.get(tabId);
  const gradingUrl = new URL(tab.url);
  await addAssignments(tabId, result.classes, forcePastYears);

  let classes = result.classes;
  let pastCount = 0;
  if (gradingUrl.searchParams.get("w") && gradingUrl.searchParams.get("p") && await pastYearsNeeded(gradingUrl.origin, forcePastYears)) {
    const past = await readPastYears(tabId, gradingUrl);
    if (past && past.length) {
      classes = [...classes, ...past];
      pastCount = past.length;
      await chrome.storage.local.set({ [`pastYears:${gradingUrl.origin}`]: currentSchoolYear() });
    }
    await chrome.tabs.update(tabId, { url: gradingUrl.href }); // back to Grading
  }

  chrome.tabs.create({ url: importUrl(base, classes) });
  return { ok: true, count: result.classes.length, pastCount };
}

// Open the page's "Calculations" dialog and read the category weights (up to ~5s)
async function readWeights(tabId) {
  try {
    const [{ result: opened }] = await chrome.scripting.executeScript({ target: { tabId }, func: ontrackOpenCalculations });
    if (!opened) return null;
    for (let i = 0; i < 10; i++) {
      await sleep(500);
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: ontrackExtractWeights });
      if (result && result.length) return result;
    }
  } catch { /* page changed — no weights */ }
  return null;
}

// Visit each class's quarter assignments pages (the pages its grades link to) in the same tab,
// read them plus the Calculations weights, then return the tab to Grading. The latest quarter
// is read every time; earlier quarters only once (they rarely change) unless forced.
async function addAssignments(tabId, classes, force) {
  const tab = await chrome.tabs.get(tabId);
  const gradingUrl = new URL(tab.url);
  const w = gradingUrl.searchParams.get("w"), p = gradingUrl.searchParams.get("p");
  if (!/\/Student\/Grading\//i.test(gradingUrl.pathname) || !w || !p) return; // unexpected page — skip
  const year = currentSchoolYear();
  const doneKey = `quartersDone:${gradingUrl.origin}:${year}`;
  const done = new Set((await chrome.storage.local.get(doneKey))[doneKey] || []);

  for (const c of classes) {
    const reports = c.reports || [];
    delete c.reports;
    const latest = reports[reports.length - 1];
    for (const r of reports) {
      const id = `${c.name}|${r.term}`;
      if (r !== latest && done.has(id) && !force) continue;
      const url = `${gradingUrl.origin}/Student/Gradebook/ProgressReport/GradeBucketBreakdownStudentAccess/${r.key}` +
        `?&w=${encodeURIComponent(w)}&p=${encodeURIComponent(p)}&generateNewDefaultWindow=true`;
      await chrome.tabs.update(tabId, { url });
      for (let i = 0; i < 20; i++) {
        await sleep(500);
        // Only read once the tab has finished loading THIS page (not the previous one)
        const t = await chrome.tabs.get(tabId);
        if (t.status !== "complete" || !(t.url || "").includes(`/GradeBucketBreakdownStudentAccess/${r.key}`)) continue;
        try {
          const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: ontrackExtractAssignments });
          if (result && result.isReport) {
            const q = { categories: result.categories, items: result.assignments };
            const weights = await readWeights(tabId);
            if (weights && weights.length) q.weights = weights;
            c.quarters = c.quarters || {};
            c.quarters[r.term] = q;
            if (r !== latest) done.add(id);
            break;
          }
        } catch { /* still loading */ }
      }
    }
  }
  await chrome.storage.local.set({ [doneKey]: [...done] });
  await chrome.tabs.update(tabId, { url: gradingUrl.href }); // back where the student started
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "update" && Number.isInteger(msg.tabId) && typeof msg.base === "string") {
    updateFromSkyward(msg.tabId, msg.base, msg.forcePastYears === true).then(sendResponse, () => sendResponse({ ok: false, error: "Something went wrong. Try again." }));
    return true; // respond asynchronously
  }
});

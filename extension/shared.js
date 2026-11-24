// Shared by popup.js and background.js

const LIVE_URL = "https://ontracklife.app";
const LOCAL_URL = "http://localhost:8081";
const ALLOWED_BASES = [LIVE_URL, LOCAL_URL];

// base64url-encode UTF-8 JSON for the link's #fragment (never sent to any server)
function encodeGrades(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function importUrl(base, classes) {
  if (!ALLOWED_BASES.includes(base)) base = LIVE_URL; // only ever send grades to OnTrack
  // Only grades and assignments go to OnTrack (never Skyward's internal page IDs)
  const clean = classes.map((c) => ({ name: c.name, terms: c.terms, year: c.year, ...(c.quarters ? { quarters: c.quarters } : {}) }));
  const payload = { v: 1, source: "skyward", importedAt: new Date().toISOString(), classes: clean };
  return `${base}/import-grades#grades=${encodeGrades(payload)}`;
}

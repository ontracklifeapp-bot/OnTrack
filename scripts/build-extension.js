// Builds the Chrome Web Store upload: extension-release/ and ontrack-extension-<version>.zip
// Removes test-only parts (local test copy option, localhost address, test/ folder).
// Usage: node scripts/build-extension.js
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const src = path.join(root, "extension");
const out = path.join(root, "extension-release");
const SHIP = ["manifest.json", "popup.html", "popup.css", "popup.js", "background.js", "extract.js", "shared.js", "icons"];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of SHIP) fs.cpSync(path.join(src, f), path.join(out, f), { recursive: true });

// Only the live site may receive grades in the store build
const sharedPath = path.join(out, "shared.js");
let shared = fs.readFileSync(sharedPath, "utf8");
shared = shared.replace(/const ALLOWED_BASES = \[LIVE_URL, LOCAL_URL\];/, "const ALLOWED_BASES = [LIVE_URL];");
shared = shared.replace(/const LOCAL_URL = "http:\/\/localhost:\d+";/, "const LOCAL_URL = LIVE_URL; // store build: no local test copy");
if (!shared.includes("const ALLOWED_BASES = [LIVE_URL];")) throw new Error("shared.js: ALLOWED_BASES not found");
fs.writeFileSync(sharedPath, shared);

// Remove the "send to local test copy" checkbox
const popupPath = path.join(out, "popup.html");
let popup = fs.readFileSync(popupPath, "utf8");
const before = popup;
popup = popup.replace(/\s*<label class="dev">\s*<input type="checkbox" id="useLocal" \/>[^<]*<\/label>/, "");
if (popup === before) throw new Error("popup.html: test checkbox not found");
fs.writeFileSync(popupPath, popup);

const version = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8")).version;
const zip = path.join(root, `ontrack-extension-${version}.zip`);
fs.rmSync(zip, { force: true });
execFileSync("zip", ["-r", "-X", "-q", zip, "."], { cwd: out });
console.log(`Built ${path.relative(root, zip)} from extension-release/`);

# Chrome Web Store listing — OnTrack Grades Import

Build the upload with `node scripts/build-extension.js` → `ontrack-extension-<version>.zip`.

---

## Store listing tab

**Name** (from the manifest): OnTrack — Grades Import

**Summary** (max 132 characters):
> Import your grades and assignments from your school's gradebook into OnTrack. One click, no passwords.

**Category:** Education  ·  **Language:** English

**Description:**
> OnTrack — Grades Import brings your grades into OnTrack (https://ontracklife.app), the free planner for tasks, bills, homework and reminders.
>
> Sign in to your school's gradebook like you normally do, click the OnTrack icon, and press Update OnTrack. The extension opens your grades in your tab, reads them, and sends them to your OnTrack account, where you can:
>
> • See every class with its official grade, plus the exact grade calculated from your assignments
> • Browse assignments by category with your teacher's real category weights
> • Switch between quarters and semesters
> • Try "what-if" scores to see what you need on the next test
> • See how grades changed since your last update
> • Look back at past school years
>
> Private by design:
> • OnTrack never asks for or stores your school password — you sign in to your gradebook yourself.
> • The extension runs only when you click it, and only on your gradebook site, which you approve the first time.
> • It doesn't run in the background and doesn't read other websites.
> • Your grades are visible only to you, and you can delete them anytime.
>
> Works with Skyward Family Access. Home Access Center (HAC) support is coming soon.
>
> OnTrack is not affiliated with or endorsed by Skyward, PowerSchool, or your school district.

**Icon:** `icons/icon-128.png` (already in the package)

**Screenshots:** 1280×800 — see "Images" below.
**Small promo tile:** 440×280.

**Homepage URL:** https://ontracklife.app
**Support URL:** mailto:ontrack.lifeapp@gmail.com (or https://ontracklife.app)

---

## Privacy practices tab

**Single purpose:**
> Import the signed-in student's own grades and assignments from their school's gradebook website into their OnTrack account, when they click the extension.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `activeTab` | Lets the extension read the gradebook page the student is looking at, only after they click the extension icon. |
| `scripting` | Runs the grade-reading code on the student's gradebook tab (and on its class and history pages) to collect the grades and assignments shown there. |
| `storage` | Remembers, on the student's own computer, which past school years and finished quarters have already been imported, so later updates are faster. No grades or personal data are stored. |
| Host permission (optional, requested at runtime) | Requested for the student's own gradebook site only (e.g. https://skyward.<district>.net), the first time they press Update OnTrack, so the extension can open their Grading, class and Academic History pages in their tab. School districts host gradebooks on many different domains, so the specific site is requested when used rather than listed in advance. |
| Remote code | **No** — the extension does not use remote code. All code is in the package. |

**Data usage — what the extension handles:**
- ☑ **Website content** — the grades, class names, assignments, scores and category weights shown on the student's gradebook pages.
- ☐ Everything else (personally identifiable info, health, financial, authentication info, personal communications, location, web history, user activity) — **not collected**. The extension never reads or handles passwords.

**Certifications (tick all three):**
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://ontracklife.app/privacy

---

## Test instructions (paste into the "Test instructions" box)

> The extension imports a student's grades from their school's Skyward gradebook. Because reviewers won't have a school account, we host a demo page with the same layout as Skyward's "Student Grades" page and made-up grades:
>
> 1. Open https://ontracklife.app/demo-gradebook/
> 2. Click the OnTrack extension icon. The popup lists 5 demo classes (AP Biology, English III Honors, Algebra II, US History, Spanish II).
> 3. Click "Send to OnTrack". Chrome asks to allow the extension on ontracklife.app — click Allow. (On a real school site it asks for that school's Skyward site.)
> 4. A new OnTrack tab opens. Create a free account (any email) or sign in.
> 5. The "Review import" screen shows the classes. Click "Save".
> 6. OnTrack's Grades screen now shows the demo classes. Tap one to see its grades.
>
> On a real Skyward site, the same button also opens each class's assignments page, its "Calculations" weights and the Academic History page in the student's own tab, which requires the student to be signed in. The demo page only covers the grades table. The extension never asks for or sees any password and runs only when clicked.

## Distribution

Start with **Unlisted** (only people with the link can install), test with a few students, then switch to **Public**.

---

## Images

Screenshots should use sample (made-up) grades, not a real student's.
- Screenshot 1: OnTrack Grades list
- Screenshot 2: A class with assignments by category
- Screenshot 3: What-if mode
- Screenshot 4: The extension popup on a gradebook page
- Promo tile 440×280: OnTrack logo + "Your grades, on track."

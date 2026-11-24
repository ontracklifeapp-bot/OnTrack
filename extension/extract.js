// Reads the grades table from the Skyward page the student is looking at.
// Runs only when the student clicks the extension, only in that tab, and only reads
// what's already on screen — it never logs in, clicks anything, or touches passwords.
//
// Must stay self-contained: popup.js passes this function to chrome.scripting.executeScript.
// (Kept in its own file so the same logic can be tested outside the extension.)
function ontrackExtractGrades() {
  function txt(el) { return ((el && el.innerText) || "").replace(/\s+/g, " ").trim(); }

  // Skyward column labels → OnTrack term keys (Q1/T1/MP1 → MP1, S1 → SM1, SE1/EX1 → EX1)
  function normTerm(h) {
    h = h.toUpperCase().replace(/[^A-Z0-9]/g, "");
    var m;
    if (/^CZ\d$/.test(h)) return null; // citizenship — skip
    if ((m = h.match(/^(?:SE|EX|EXAM|FIN|FE)0?(\d)$/))) return "EX" + m[1];
    if ((m = h.match(/^(?:T|TERM|MP|Q|NW)0?(\d)$/))) { var n = parseInt(m[1], 10); if (n >= 1 && n <= 4) return "MP" + n; }
    if ((m = h.match(/^(?:S|SM|SEM)0?(\d)$/))) return "SM" + m[1];
    return null;
  }

  // School year label ("2025 - 2026") shown just above a grades table
  function findYearBefore(table) {
    var el = table;
    for (var hops = 0; hops < 6 && el; hops++) {
      var sib = el.previousElementSibling;
      while (sib) {
        var mm = (sib.innerText || "").match(/(\d{4})\s*[-–]\s*(\d{4})/);
        if (mm) return mm[1] + "-" + mm[2];
        sib = sib.previousElementSibling;
      }
      el = el.parentElement;
    }
    return null;
  }

  // Skyward often splits each year into a HEADER table (Class | T1 | T2 …) followed by a
  // DATA table of class rows, so remember the latest header's columns for the tables after it.
  var classes = [];
  var colMap = null;

  document.querySelectorAll("table").forEach(function (table) {
    var rows = table.querySelectorAll("tr");
    if (rows.length === 0) return;

    var first = rows[0].querySelectorAll("th, td");
    var cm = {}, termCount = 0, hasClass = false;
    first.forEach(function (cell, i) {
      var raw = txt(cell);
      if (/class|course/i.test(raw)) hasClass = true;
      var t = normTerm(raw);
      if (t) { cm[i] = t; termCount++; }
    });
    var isHeader = hasClass && termCount >= 2;
    // Skyward's "frozen first column" copies (just the Class column) sit between the header
    // and the grades — skip them without forgetting the header's columns
    if (!isHeader && first.length < 3) return;
    if (isHeader) colMap = cm;
    var map = isHeader ? cm : colMap;
    // A header's columns carry over only to the very next table, and only when the header
    // table had no class rows of its own (Skyward's split header/data layout)
    if (!isHeader || rows.length > 1) colMap = null;
    if (!map) return;

    var year = findYearBefore(table);
    for (var ri = isHeader ? 1 : 0; ri < rows.length; ri++) {
      var cells = rows[ri].querySelectorAll("th, td");
      if (cells.length < 3) continue;
      // First line only — the lines under it are the period / teacher
      var firstLine = (cells[0].innerText || "").split("\n").filter(function (l) { return l.trim(); })[0] || "";
      var name = firstLine.replace(/\s+/g, " ").replace(/^[↑↓\s0-9]+/, "").trim();
      if (!name || name.length < 3) continue;
      if (/^(class|course|length|citizenship|lunch|conduct|student sections)/i.test(name)) continue;

      var terms = {};
      // Each quarter's (MP) grade links to that quarter's assignments page
      var reports = [];
      Object.keys(map).forEach(function (idx) {
        var cell = cells[parseInt(idx, 10)];
        if (!cell) return;
        var v = parseFloat(txt(cell).replace(/[^0-9.\-]/g, ""));
        if (!isNaN(v) && v >= 0 && v <= 150) {
          terms[map[idx]] = v;
          var link = cell.querySelector("a[data-primarykey][data-screen='GradeBucketBreakdownStudentAccess']");
          if (link && /^MP\d$/.test(map[idx]) && /^\d+$/.test(link.getAttribute("data-primarykey"))) {
            reports.push({ term: map[idx], key: link.getAttribute("data-primarykey") });
          }
        }
      });
      if (Object.keys(terms).length > 0) {
        var entry = { name: name.slice(0, 100), terms: terms, year: year };
        if (reports.length) entry.reports = reports;
        classes.push(entry);
      }
    }
  });

  // Same class listed twice (e.g. header + detail views) → keep the fullest row
  var byKey = {};
  classes.forEach(function (c) {
    var k = (c.year || "current") + "|" + c.name.toUpperCase();
    if (!byKey[k] || Object.keys(c.terms).length > Object.keys(byKey[k].terms).length) byKey[k] = c;
  });

  return {
    source: "skyward",
    looksLikeSkyward: /skyward/i.test(location.hostname + document.title),
    classes: Object.keys(byKey).map(function (k) { return byKey[k]; }).slice(0, 150),
  };
}

// Reads one class's assignments from Skyward's Progress Report page (the page a grade links to).
// Category rows (e.g. "Tests") are followed by that category's assignments. Weights aren't
// shown on this page, so only category names are returned.
function ontrackExtractAssignments() {
  function cellText(c) { return ((c && c.innerText) || "").replace(/\s+/g, " ").trim(); }
  var body = null;
  document.querySelectorAll("table").forEach(function (t) {
    if (!body && /browseTable/i.test(t.className) && t.querySelectorAll("tr").length > 0) {
      body = t;
    }
  });
  var header = document.querySelector("table.fillWidth");
  var headerCells = header ? Array.prototype.map.call(header.querySelectorAll("th, td"), cellText) : [];
  var col = function (re, fallback) { var i = headerCells.findIndex(function (h) { return re.test(h); }); return i >= 0 ? i : fallback; };
  var iDesc = col(/^description$/i, 1), iDue = col(/due/i, 2), iPts = col(/points/i, 5);

  var isReport = /progress report/i.test(document.title) && !!body;
  var categories = [], assignments = [], category = null;
  if (isReport) {
    body.querySelectorAll("tr").forEach(function (tr) {
      var c = tr.querySelectorAll("th, td");
      var name = cellText(c[iDesc]).slice(0, 100);
      if (!name) return;
      var due = cellText(c[iDue]);
      var hasDue = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(due);
      if (!hasDue && /segmentedBrowseParentRow/i.test(tr.className + " " + (c[0] && c[0].className))) {
        category = name.slice(0, 60);
        if (categories.indexOf(category) < 0) categories.push(category);
        return;
      }
      if (!hasDue) {
        // Some layouts don't mark category rows — a row without a due date that isn't an assignment
        if (!/\d+(\.\d+)?\s*\/\s*\d+/.test(cellText(c[iPts]))) return;
        category = name.slice(0, 60);
        if (categories.indexOf(category) < 0) categories.push(category);
        return;
      }
      var pts = cellText(c[iPts]).match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
      var a = { name: name, category: category, due: due.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)[0] };
      if (pts) { a.score = parseFloat(pts[1]); a.maxScore = parseFloat(pts[2]); }
      assignments.push(a);
    });
  }
  return { isReport: isReport, categories: categories.slice(0, 20), assignments: assignments.slice(0, 200) };
}

// On a class's Progress Report page: open Skyward's "Calculations" dialog (the toolbar button
// the student would click) so its category weights can be read. Returns false if there isn't one.
function ontrackOpenCalculations() {
  var btn = document.querySelector("a[data-click-action='progressreport.viewGradeBucketCalculation']");
  if (!btn) return false;
  btn.click();
  return true;
}

// Reads the category weights from the open Calculations dialog, e.g.
// Classwork/Homework 10 · Experiments/Labs 10 · Quizzes 30 · Tests 50.
function ontrackExtractWeights() {
  function cellText(c) { return ((c && c.innerText) || "").replace(/\s+/g, " ").trim(); }
  var dialogs = Array.prototype.filter.call(document.querySelectorAll("[id^='modalLayerDialog'], [role=dialog]"), function (d) {
    return d.offsetParent !== null && /weight percent/i.test(d.textContent || "");
  });
  var dlg = dialogs[0];
  if (!dlg) return null;
  var header = null, body = null;
  dlg.querySelectorAll("table").forEach(function (t) {
    if (!header && /weight percent/i.test(t.textContent || "")) header = t;
    else if (header && !body && /browseTable/i.test(t.className)) body = t;
  });
  if (!header || !body) return null;
  var heads = Array.prototype.map.call(header.querySelectorAll("th, td"), cellText);
  var iName = heads.findIndex(function (h) { return /category/i.test(h); });
  var iWeight = heads.findIndex(function (h) { return /^weight percent$/i.test(h); });
  if (iName < 0 || iWeight < 0) return null;
  var weights = [];
  body.querySelectorAll("tr").forEach(function (tr) {
    var c = tr.querySelectorAll("th, td");
    var name = cellText(c[iName]).slice(0, 60);
    var w = parseFloat(cellText(c[iWeight]));
    if (name && !isNaN(w) && w >= 0 && w <= 100) weights.push({ name: name, weight: w });
  });
  return weights.slice(0, 20);
}

// Which gradebook site this tab is on. One extension serves both: Skyward pages are read by the
// functions above; HAC (Home Access Center, e.g. …/HomeAccess/Content/Student/Assignments.aspx)
// gets its own readers when HAC support is added.
function ontrackDetectGradebook() {
  var url = location.hostname + location.pathname;
  if (/\/HomeAccess\//i.test(location.pathname) || /home access center/i.test(document.title)) return "hac";
  if (/skyward/i.test(url + " " + document.title) || /\/scripts\/wsisa\.dll\//i.test(location.pathname)) return "skyward";
  return null;
}

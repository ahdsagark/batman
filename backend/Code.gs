/**
 * ============================================================================
 * BATMAN — Google Apps Script Backend Router
 * 9-Month Personal Transformation Command Center
 * ============================================================================
 */

function getApiSecret() {
  var props = PropertiesService.getScriptProperties();
  var secret = props ? props.getProperty("BATMAN_API_SECRET") : null;
  if (!secret) {
    secret = "batman-secret-2026";
  }
  return secret;
}

function doGet(e) {
  return handleResponse({
    success: true,
    message: "BATMAN Google Apps Script API is online.",
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return handleResponse({ success: false, error: "Empty request payload" });
    }

    var request = JSON.parse(e.postData.contents);
    var action = request.action;
    var payload = request.payload || {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Request Authentication
    var expectedToken = getApiSecret();
    if (!request.token || request.token !== expectedToken) {
      return handleResponse({ success: false, error: "Unauthorized: Invalid or missing API token." });
    }

    if (!action) {
      return handleResponse({ success: false, error: "Action parameter is missing" });
    }

    switch (action) {
      case "ping":
        return handleResponse({
          success: true,
          message: "BATMAN Backend Connected Successfully",
          serverTime: new Date().toISOString()
        });

      case "syncBatch":
        return handleSyncBatch(ss, payload.items || []);

      default:
        return handleResponse({ success: false, error: "Unrecognized action: " + action });
    }
  } catch (err) {
    return handleResponse({ success: false, error: err.toString() });
  }
}

/**
 * Centralized Google Sheets formula injection sanitizer
 * Neutralizes values starting with =, +, -, @ by prefixing with a single quote (')
 */
function sanitizeSheetValue(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean" || typeof val === "number") return val;
  var str = val.toString();
  if (str.length > 0) {
    var firstChar = str.charAt(0);
    if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
      return "'" + str;
    }
  }
  return str;
}

function sanitizeRowValues(rowArray) {
  if (!Array.isArray(rowArray)) return [];
  return rowArray.map(function(cell) {
    return sanitizeSheetValue(cell);
  });
}

/**
 * Handles batch synchronization with strict idempotency (upsert by record ID)
 */
function handleSyncBatch(ss, items) {
  var results = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var table = item.table;
    var data = item.data || {};
    var recordId = data.id || item.id;

    if (!recordId) continue;

    if (table === "DayLogs") {
      syncDayLog(ss, data);
    } else if (table === "IELTS") {
      upsertRowById(ss, "IELTS", recordId, [
        recordId,
        data.date,
        data.listening,
        data.reading,
        data.writing,
        data.speaking,
        data.overall,
        data.timestamp || new Date().toISOString()
      ]);
    } else if (table === "Settings") {
      upsertSetting(ss, "user_settings", JSON.stringify(data));
    } else if (table === "Goals") {
      upsertRowById(ss, "Goals", recordId, [
        recordId,
        data.title || "",
        data.pillar || "",
        data.targetDate || "",
        data.status || "IN_PROGRESS",
        JSON.stringify(data.milestones || []),
        data.updatedAt || new Date().toISOString()
      ]);
    } else if (table === "Routines") {
      upsertRowById(ss, "Routines", recordId, [
        recordId,
        data.name || "",
        data.time || "",
        data.duration || 30,
        JSON.stringify(data.days || []),
        data.anchor || "fixed",
        data.isActive ? "TRUE" : "FALSE",
        data.updatedAt || new Date().toISOString()
      ]);
    } else if (table === "WeeklyReviews") {
      upsertRowById(ss, "WeeklyReviews", recordId, [
        recordId,
        data.weekStartDate,
        data.deenScore,
        data.cyberHours,
        data.englishHours,
        data.gymCount,
        data.avgSleep,
        data.biggestWin,
        data.biggestProblem,
        data.nextPriority,
        data.timestamp || new Date().toISOString()
      ]);
    }
    results.push({ id: recordId, status: "UPSERTED" });
  }

  return handleResponse({ success: true, processed: results.length, results: results });
}

/**
 * Idempotently synchronize daily log across Day-specific sheets
 */
function syncDayLog(ss, dayData) {
  var dateStr = dayData.date;
  if (!dateStr) return;

  var now = new Date().toISOString();

  // 1. Prayer Records (5 Prayers)
  if (dayData.prayers) {
    var prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    for (var p = 0; p < prayers.length; p++) {
      var pName = prayers[p];
      var pObj = dayData.prayers[pName] || {};
      var prayerId = "prayer-" + dateStr + "-" + pName;
      upsertRowById(ss, "PrayerRecords", prayerId, [
        prayerId,
        dateStr,
        pName,
        pObj.status || "NOT_COMPLETED",
        pObj.location || "",
        pObj.timestamp || now
      ]);
    }
  }

  // 2. Tahajjud
  var tahajjudId = "tahajjud-" + dateStr;
  upsertRowById(ss, "Tahajjud", tahajjudId, [
    tahajjudId,
    dateStr,
    dayData.tahajjud || "MISSED",
    now
  ]);

  // 3. Quran Sessions (AM Tafsir & PM Recitation)
  var quranAmId = "quran-am-" + dateStr;
  upsertRowById(ss, "QuranSessions", quranAmId, [
    quranAmId,
    dateStr,
    "AM_TAFSIR",
    dayData.quranTafsir || "NOT_COMPLETED",
    now
  ]);

  var quranPmId = "quran-pm-" + dateStr;
  upsertRowById(ss, "QuranSessions", quranPmId, [
    quranPmId,
    dateStr,
    "PM_RECITATION",
    dayData.quranRecitation || "NOT_COMPLETED",
    now
  ]);

  // 4. ADCD Attendance
  var adcdId = "adcd-" + dateStr;
  upsertRowById(ss, "ADCD", adcdId, [
    adcdId,
    dateStr,
    dayData.adcdAttended || "NOT_ATTENDED",
    now
  ]);

  // 5. Fitness & Weight
  var fitnessId = "fit-" + dateStr;
  upsertRowById(ss, "Fitness", fitnessId, [
    fitnessId,
    dateStr,
    dayData.gymAttended ? "TRUE" : "FALSE",
    dayData.weightKg || "",
    dayData.bmi || "",
    now
  ]);

  // 6. Sleep
  var sleepId = "sleep-" + dateStr;
  upsertRowById(ss, "Sleep", sleepId, [
    sleepId,
    dateStr,
    dayData.sleepHours || "",
    dayData.bedtime || "",
    dayData.waketime || "",
    now
  ]);

  // 7. Daily Review
  if (dayData.review) {
    var revId = "rev-" + dateStr;
    var rev = dayData.review;
    upsertRowById(ss, "DailyReviews", revId, [
      revId,
      dateStr,
      rev.deenRating || "",
      rev.cyberRating || "",
      rev.englishRating || "",
      rev.fitnessRating || "",
      rev.energyRating || "",
      rev.whatWentWell || "",
      rev.whatWentWrong || "",
      rev.whatToImprove || "",
      now
    ]);
  }
}

// In-memory sheet and row cache for high-performance batch processing
var _sheetsCache = {};

function getSheetContext(ss, sheetName) {
  if (!_sheetsCache[sheetName]) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return null;
    var data = sheet.getDataRange().getValues();
    var idMap = {};
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] !== "" && data[i][0] !== null && data[i][0] !== undefined) {
        idMap[data[i][0].toString()] = i + 1; // 1-based row index in sheet
      }
    }
    _sheetsCache[sheetName] = {
      sheet: sheet,
      idMap: idMap,
      lastRow: sheet.getLastRow()
    };
  }
  return _sheetsCache[sheetName];
}

/**
 * Generic Idempotent Row Upsert based on Column 1 (ID) with Sanitization & Caching
 */
function upsertRowById(ss, sheetName, recordId, rowValues) {
  var ctx = getSheetContext(ss, sheetName);
  if (!ctx) return;

  var sanitizedValues = sanitizeRowValues(rowValues);
  var targetRowIndex = ctx.idMap[recordId.toString()];

  if (targetRowIndex) {
    ctx.sheet.getRange(targetRowIndex, 1, 1, sanitizedValues.length).setValues([sanitizedValues]);
  } else {
    ctx.sheet.appendRow(sanitizedValues);
    ctx.lastRow++;
    ctx.idMap[recordId.toString()] = ctx.lastRow;
  }
}

/**
 * Upsert key-value in Settings tab with Sanitization & Caching
 */
function upsertSetting(ss, key, value) {
  var ctx = getSheetContext(ss, "Settings");
  if (!ctx) return;

  var now = new Date().toISOString();
  var sanitizedRow = sanitizeRowValues([key, value, now]);
  var targetRowIndex = ctx.idMap[key.toString()];

  if (targetRowIndex) {
    ctx.sheet.getRange(targetRowIndex, 1, 1, 3).setValues([sanitizedRow]);
  } else {
    ctx.sheet.appendRow(sanitizedRow);
    ctx.lastRow++;
    ctx.idMap[key.toString()] = ctx.lastRow;
  }
}

/**
 * Helper to build JSON output
 */
function handleResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

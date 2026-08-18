/**
 * ============================================================================
 * BATMAN — Google Apps Script Backend Router
 * 9-Month Personal Transformation Command Center
 * ============================================================================
 */

function getApiSecret() {
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props ? props.getProperty("BATMAN_API_SECRET") : null;
    if (secret && secret.toString().trim().length > 0) {
      return secret.toString().trim();
    }
  } catch(e) {}
  return "batman-secret-2026";
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  var token = (e && e.parameter && e.parameter.token) ? e.parameter.token : "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var expectedToken = getApiSecret();
  if (action === "pullAllData") {
    if (token !== expectedToken && token !== "batman-secret-2026") {
      return handleResponse({ success: false, error: "Unauthorized: Invalid or missing API token in GET request." });
    }
    return handlePullAllData(ss);
  }

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

    // 1. Request Authentication (accepts custom script property or default token)
    var expectedToken = getApiSecret();
    var providedToken = (request.token || "").toString().trim();
    if (providedToken !== expectedToken && providedToken !== "batman-secret-2026") {
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

      case "pullAllData":
        return handlePullAllData(ss);

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
 * Delete a row by ID from sheet
 */
function deleteRowById(ss, sheetName, id) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return false;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
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

    if (item.action === "DELETE") {
      deleteRowById(ss, table, recordId);
      results.push({ id: recordId, status: "DELETED" });
      continue;
    }

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
    } else if (table === "QuranMemorization") {
      var memoId = recordId;
      var sNum = data.surahNumber || data.surah_number || "";
      var sName = data.surahName || data.surah_name || "";
      var tVerses = data.totalVerses || data.total_verses || "";
      var vDone = data.versesMemorized !== undefined ? data.versesMemorized : (data.verses_memorized || 0);
      var tMemo = data.todayMemorized !== undefined ? data.todayMemorized : (data.today_memorized || 0);
      var isComp = (vDone >= tVerses && tVerses > 0);
      var statusText = data.status || (isComp ? "COMPLETED (100%)" : (vDone > 0 ? "IN_PROGRESS (" + Math.round((vDone / tVerses) * 100) + "%)" : "NOT_STARTED"));
      upsertRowById(ss, "QuranMemorization", memoId, [
        memoId,
        sNum,
        sName,
        tVerses,
        vDone,
        tMemo,
        statusText,
        data.date || "",
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

  // 8. Cyber Deep Work Duration
  if (dayData.cyberSeconds !== undefined && dayData.cyberSeconds !== null) {
    var cyberId = "cyber-" + dateStr;
    upsertRowById(ss, "CyberSessions", cyberId, [
      cyberId,
      dateStr,
      "",
      "",
      dayData.cyberSeconds,
      now
    ]);
  }

  // 9. English Practice Duration
  if (dayData.englishSeconds !== undefined && dayData.englishSeconds !== null) {
    var engId = "english-" + dateStr;
    upsertRowById(ss, "EnglishSessions", engId, [
      engId,
      dateStr,
      "",
      "",
      dayData.englishSeconds,
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

/**
 * Universal Date Normalizer: Converts Google Sheets native Date object or ISO string to 'YYYY-MM-DD'
 */
function normalizeDateStr(val) {
  if (!val) return "";
  if (val instanceof Date) {
    var year = val.getFullYear();
    var month = String(val.getMonth() + 1);
    if (month.length < 2) month = "0" + month;
    var day = String(val.getDate());
    if (day.length < 2) day = "0" + day;
    return year + "-" + month + "-" + day;
  }
  var str = val.toString().trim();
  if (str.length >= 10 && str.charAt(4) === '-' && str.charAt(7) === '-') {
    return str.substring(0, 10);
  }
  var parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    var y = parsed.getFullYear();
    var m = String(parsed.getMonth() + 1);
    if (m.length < 2) m = "0" + m;
    var d = String(parsed.getDate());
    if (d.length < 2) d = "0" + d;
    return y + "-" + m + "-" + d;
  }
  return str;
}

/**
 * Universal Time Normalizer: Converts Google Sheets native Time/Date object or ISO string to 'HH:MM'
 */
function normalizeTimeStr(val) {
  if (!val) return "05:00";
  if (val instanceof Date) {
    var h = String(val.getHours());
    if (h.length < 2) h = "0" + h;
    var m = String(val.getMinutes());
    if (m.length < 2) m = "0" + m;
    return h + ":" + m;
  }
  var str = val.toString().trim();
  if (str.indexOf('T') >= 0) {
    var d = new Date(str);
    if (!isNaN(d.getTime())) {
      var hh = String(d.getHours());
      if (hh.length < 2) hh = "0" + hh;
      var mm = String(d.getMinutes());
      if (mm.length < 2) mm = "0" + mm;
      return hh + ":" + mm;
    }
  }
  var parts = str.split(':');
  if (parts.length >= 2) {
    var hourNum = parseInt(parts[0].replace(/[^0-9]/g, ''), 10) || 0;
    var minNum = parseInt(parts[1].replace(/[^0-9]/g, ''), 10) || 0;
    var hourStr = String(hourNum);
    if (hourStr.length < 2) hourStr = "0" + hourStr;
    var minStr = String(minNum);
    if (minStr.length < 2) minStr = "0" + minStr;
    return hourStr + ":" + minStr;
  }
  return str;
}

/**
 * Consolidated Database Export for multi-device synchronization & hydration
 */
function handlePullAllData(ss) {
  var data = {
    settings: {},
    dayLogs: {},
    ielts: [],
    goals: [],
    routines: [],
    weeklyReviews: {},
    exportedAt: new Date().toISOString()
  };

  // 1. Settings
  var settingsSheet = ss.getSheetByName("Settings");
  if (settingsSheet) {
    var settingsData = settingsSheet.getDataRange().getValues();
    for (var i = 1; i < settingsData.length; i++) {
      var key = settingsData[i][0];
      var val = settingsData[i][1];
      if (key === "user_settings" && val) {
        try {
          data.settings = JSON.parse(val);
        } catch(e) {}
      } else if (key) {
        data.settings[key] = val;
      }
    }
  }

  // 2. Routines
  var routinesSheet = ss.getSheetByName("Routines");
  if (routinesSheet) {
    var routinesData = routinesSheet.getDataRange().getValues();
    for (var i = 1; i < routinesData.length; i++) {
      var row = routinesData[i];
      if (!row[0]) continue;
      var daysArr = [];
      try { daysArr = JSON.parse(row[4] || "[]"); } catch(e) {}
      data.routines.push({
        id: row[0],
        name: row[1] || "",
        time: normalizeTimeStr(row[2]),
        duration: parseInt(row[3], 10) || 30,
        days: daysArr,
        anchor: row[5] || "fixed",
        isActive: row[6] === "TRUE" || row[6] === true,
        updatedAt: row[7] || ""
      });
    }
  }

  // Helper to ensure dayLogs entry exists with YYYY-MM-DD format
  function getDayLog(dateInput) {
    var dateStr = normalizeDateStr(dateInput);
    if (!dateStr) return null;
    if (!data.dayLogs[dateStr]) {
      data.dayLogs[dateStr] = {
        date: dateStr,
        prayers: {
          fajr: { status: 'NOT_COMPLETED', location: '', timestamp: null },
          dhuhr: { status: 'NOT_COMPLETED', location: '', timestamp: null },
          asr: { status: 'NOT_COMPLETED', location: '', timestamp: null },
          maghrib: { status: 'NOT_COMPLETED', location: '', timestamp: null },
          isha: { status: 'NOT_COMPLETED', location: '', timestamp: null }
        },
        tahajjud: 'MISSED',
        quranTafsir: 'NOT_COMPLETED',
        quranMemoCount: 0,
        quranRecitation: 'NOT_COMPLETED',
        islamicLearning: 'NOT_COMPLETED',
        adcdAttended: 'NOT_ATTENDED',
        cyberSeconds: 0,
        englishSeconds: 0,
        gymAttended: false,
        weightKg: null,
        bmi: null,
        sleepHours: null,
        review: null,
        updatedAt: ""
      };
    }
    return data.dayLogs[dateStr];
  }

  // 3. Prayer Records
  var prayerSheet = ss.getSheetByName("PrayerRecords");
  if (prayerSheet) {
    var prayerData = prayerSheet.getDataRange().getValues();
    for (var i = 1; i < prayerData.length; i++) {
      var row = prayerData[i];
      var d = row[1];
      var pName = row[2];
      if (d && pName) {
        var day = getDayLog(d);
        if (day) {
          day.prayers[pName] = {
            status: row[3] || 'NOT_COMPLETED',
            location: row[4] || '',
            timestamp: row[5] || null
          };
        }
      }
    }
  }

  // 4. Tahajjud
  var tahajjudSheet = ss.getSheetByName("Tahajjud");
  if (tahajjudSheet) {
    var tahajjudData = tahajjudSheet.getDataRange().getValues();
    for (var i = 1; i < tahajjudData.length; i++) {
      var row = tahajjudData[i];
      var d = row[1];
      if (d) {
        var day = getDayLog(d);
        if (day) day.tahajjud = row[2] || 'MISSED';
      }
    }
  }

  // 5. QuranSessions
  var quranSheet = ss.getSheetByName("QuranSessions");
  if (quranSheet) {
    var quranData = quranSheet.getDataRange().getValues();
    for (var i = 1; i < quranData.length; i++) {
      var row = quranData[i];
      var d = row[1];
      var sessType = row[2];
      if (d && sessType) {
        var day = getDayLog(d);
        if (day) {
          if (sessType === "AM_TAFSIR") day.quranTafsir = row[3] || 'NOT_COMPLETED';
          if (sessType === "PM_RECITATION") day.quranRecitation = row[3] || 'NOT_COMPLETED';
        }
      }
    }
  }

  // 6. ADCD
  var adcdSheet = ss.getSheetByName("ADCD");
  if (adcdSheet) {
    var adcdData = adcdSheet.getDataRange().getValues();
    for (var i = 1; i < adcdData.length; i++) {
      var row = adcdData[i];
      var d = row[1];
      if (d) {
        var day = getDayLog(d);
        if (day) day.adcdAttended = row[2] || 'NOT_ATTENDED';
      }
    }
  }

  // 7. Fitness
  var fitSheet = ss.getSheetByName("Fitness");
  if (fitSheet) {
    var fitData = fitSheet.getDataRange().getValues();
    for (var i = 1; i < fitData.length; i++) {
      var row = fitData[i];
      var d = row[1];
      if (d) {
        var day = getDayLog(d);
        if (day) {
          day.gymAttended = (row[2] === true || row[2] === "TRUE");
          day.weightKg = row[3] ? parseFloat(row[3]) : null;
          day.bmi = row[4] ? parseFloat(row[4]) : null;
        }
      }
    }
  }

  // 8. Sleep
  var sleepSheet = ss.getSheetByName("Sleep");
  if (sleepSheet) {
    var sleepData = sleepSheet.getDataRange().getValues();
    for (var i = 1; i < sleepData.length; i++) {
      var row = sleepData[i];
      var d = row[1];
      if (d) {
        var day = getDayLog(d);
        if (day) {
          day.sleepHours = row[2] ? parseFloat(row[2]) : null;
          day.bedtime = row[3] || "";
          day.waketime = row[4] || "";
        }
      }
    }
  }

  // 9. Cyber Sessions
  var cyberSheet = ss.getSheetByName("CyberSessions");
  if (cyberSheet) {
    var cyberData = cyberSheet.getDataRange().getValues();
    for (var i = 1; i < cyberData.length; i++) {
      var row = cyberData[i];
      var d = row[1];
      var secs = parseFloat(row[4]) || 0;
      if (d) {
        var day = getDayLog(d);
        if (day) day.cyberSeconds = (day.cyberSeconds || 0) + secs;
      }
    }
  }

  // 10. English Sessions
  var engSheet = ss.getSheetByName("EnglishSessions");
  if (engSheet) {
    var engData = engSheet.getDataRange().getValues();
    for (var i = 1; i < engData.length; i++) {
      var row = engData[i];
      var d = row[1];
      var secs = parseFloat(row[4]) || 0;
      if (d) {
        var day = getDayLog(d);
        if (day) day.englishSeconds = (day.englishSeconds || 0) + secs;
      }
    }
  }

  // 11. Quran Memorization
  var memoSheet = ss.getSheetByName("QuranMemorization");
  data.quranMemorization = [];
  if (memoSheet) {
    var memoData = memoSheet.getDataRange().getValues();
    for (var i = 1; i < memoData.length; i++) {
      var row = memoData[i];
      var sNum = parseInt(row[1], 10);
      var sName = row[2] || "";
      var tVerses = parseInt(row[3], 10) || 0;
      var vDone = parseInt(row[4], 10) || 0;
      var tMemo = parseInt(row[5], 10) || 0;
      var statusStr = row[6] || "";
      var d = row[7] || "";

      if (!isNaN(sNum) && sNum >= 1 && sNum <= 114 && vDone > 0) {
        data.quranMemorization.push({
          id: row[0] || ("surah-" + sNum),
          surahNumber: sNum,
          surahName: sName,
          totalVerses: tVerses,
          versesMemorized: vDone,
          todayMemorized: tMemo,
          status: statusStr,
          date: d,
          timestamp: row[8] || ""
        });

        if (!data.settings.surahProgress) data.settings.surahProgress = {};
        data.settings.surahProgress[sNum] = vDone;
      }

      if (d && tMemo > 0) {
        var day = getDayLog(d);
        if (day) day.quranMemoCount = Math.max(day.quranMemoCount || 0, tMemo);
      }
    }
  }

  // 12. Daily Reviews
  var revSheet = ss.getSheetByName("DailyReviews");
  if (revSheet) {
    var revData = revSheet.getDataRange().getValues();
    for (var i = 1; i < revData.length; i++) {
      var row = revData[i];
      var d = row[1];
      if (d) {
        var day = getDayLog(d);
        if (day) {
          day.review = {
            deenRating: parseInt(row[2], 10) || 3,
            cyberRating: parseInt(row[3], 10) || 3,
            englishRating: parseInt(row[4], 10) || 3,
            fitnessRating: parseInt(row[5], 10) || 3,
            energyRating: parseInt(row[6], 10) || 3,
            whatWentWell: row[7] || "",
            whatWentWrong: row[8] || "",
            whatToImprove: row[9] || "",
            completedAt: row[10] || ""
          };
        }
      }
    }
  }

  // 13. IELTS
  var ieltsSheet = ss.getSheetByName("IELTS");
  if (ieltsSheet) {
    var ieltsData = ieltsSheet.getDataRange().getValues();
    for (var i = 1; i < ieltsData.length; i++) {
      var row = ieltsData[i];
      if (!row[0]) continue;
      data.ielts.push({
        id: row[0],
        date: normalizeDateStr(row[1]),
        listening: parseFloat(row[2]) || 0,
        reading: parseFloat(row[3]) || 0,
        writing: parseFloat(row[4]) || 0,
        speaking: parseFloat(row[5]) || 0,
        overall: parseFloat(row[6]) || 0,
        timestamp: row[7] || ""
      });
    }
  }

  // 14. Goals
  var goalsSheet = ss.getSheetByName("Goals");
  if (goalsSheet) {
    var goalsData = goalsSheet.getDataRange().getValues();
    for (var i = 1; i < goalsData.length; i++) {
      var row = goalsData[i];
      if (!row[0]) continue;
      var milestonesArr = [];
      try { milestonesArr = JSON.parse(row[5] || "[]"); } catch(e) {}
      data.goals.push({
        id: row[0],
        title: row[1] || "",
        pillar: row[2] || "",
        targetDate: normalizeDateStr(row[3]),
        status: row[4] || "IN_PROGRESS",
        milestones: milestonesArr,
        updatedAt: row[6] || ""
      });
    }
  }

  // 15. Weekly Reviews
  var weeklySheet = ss.getSheetByName("WeeklyReviews");
  if (weeklySheet) {
    var weeklyData = weeklySheet.getDataRange().getValues();
    for (var i = 1; i < weeklyData.length; i++) {
      var row = weeklyData[i];
      if (!row[0]) continue;
      var weekStart = normalizeDateStr(row[1] || row[0]);
      data.weeklyReviews[weekStart] = {
        id: row[0],
        weekStartDate: weekStart,
        deenScore: row[2] || 0,
        cyberHours: row[3] || 0,
        englishHours: row[4] || 0,
        gymCount: row[5] || 0,
        avgSleep: row[6] || 0,
        biggestWin: row[7] || "",
        biggestProblem: row[8] || "",
        nextPriority: row[9] || "",
        timestamp: row[10] || ""
      };
    }
  }

  return handleResponse({
    success: true,
    data: data,
    timestamp: new Date().toISOString()
  });
}

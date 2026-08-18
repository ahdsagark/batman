/**
 * ============================================================================
 * BATMAN — Google Apps Script Backend Router
 * 9-Month Personal Transformation Command Center
 * ============================================================================
 */

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

      case "savePrayer":
        return handleSavePrayer(ss, payload);

      case "saveTahajjud":
        return handleSaveTahajjud(ss, payload);

      case "saveQuranMemorization":
        return handleSaveQuranMemo(ss, payload);

      case "saveCyberSession":
        return handleSaveCyberSession(ss, payload);

      case "saveEnglishSession":
        return handleSaveEnglishSession(ss, payload);

      case "saveIELTSMock":
        return handleSaveIELTSMock(ss, payload);

      case "saveFitness":
        return handleSaveFitness(ss, payload);

      case "saveSleep":
        return handleSaveSleep(ss, payload);

      case "saveDailyReview":
        return handleSaveDailyReview(ss, payload);

      case "saveWeeklyReview":
        return handleSaveWeeklyReview(ss, payload);

      default:
        return handleResponse({ success: false, error: "Unrecognized action: " + action });
    }
  } catch (err) {
    return handleResponse({ success: false, error: err.toString() });
  }
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

/**
 * Generic Idempotent Row Upsert based on Column 1 (ID)
 */
function upsertRowById(ss, sheetName, recordId, rowValues) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  var targetRowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString() === recordId.toString()) {
      targetRowIndex = i + 1; // 1-based index
      break;
    }
  }

  if (targetRowIndex > 0) {
    // Update existing row
    sheet.getRange(targetRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    // Append new row
    sheet.appendRow(rowValues);
  }
}

/**
 * Upsert key-value in Settings tab
 */
function upsertSetting(ss, key, value) {
  var sheet = ss.getSheetByName("Settings");
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString() === key.toString()) {
      rowIndex = i + 1;
      break;
    }
  }

  var now = new Date().toISOString();
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, 3).setValues([[key, value, now]]);
  } else {
    sheet.appendRow([key, value, now]);
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

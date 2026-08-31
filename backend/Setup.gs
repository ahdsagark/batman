/**
 * ============================================================================
 * BATMAN — Database Auto-Provisioning Script for Google Sheets
 * Run this function once in Apps Script: `setupDatabase()`
 * ============================================================================
 */

function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var schemas = [
    {
      name: "Settings",
      headers: ["key", "value", "updated_at"]
    },
    {
      name: "Routines",
      headers: ["id", "name", "time", "duration_mins", "days_of_week", "relative_anchor", "is_active", "updated_at"]
    },
    {
      name: "PrayerRecords",
      headers: ["id", "date", "prayer_name", "status", "location", "timestamp"]
    },
    {
      name: "Tahajjud",
      headers: ["id", "date", "status", "timestamp"]
    },
    {
      name: "SunnahRakat",
      headers: ["id", "date", "before_fajr", "before_dhuhr", "after_dhuhr", "after_maghrib", "after_isha", "total_rakat", "timestamp"]
    },
    {
      name: "DuhaWitr",
      headers: ["id", "date", "duha_status", "witr_status", "timestamp"]
    },
    {
      name: "Adhkar",
      headers: ["id", "date", "morning_adhkar", "evening_adhkar", "sleep_adhkar", "timestamp"]
    },
    {
      name: "QuranSessions",
      headers: ["id", "date", "session_type", "status", "timestamp"]
    },
    {
      name: "QuranMemorization",
      headers: ["id", "surah_number", "surah_name", "total_verses", "verses_memorized", "today_memorized", "status", "date", "timestamp"]
    },
    {
      name: "CyberSessions",
      headers: ["id", "date", "start_time", "end_time", "duration_seconds", "timestamp"]
    },
    {
      name: "ADCD",
      headers: ["id", "date", "status", "timestamp"]
    },
    {
      name: "EnglishSessions",
      headers: ["id", "date", "start_time", "end_time", "duration_seconds", "timestamp"]
    },
    {
      name: "IELTS",
      headers: ["id", "date", "listening", "reading", "writing", "speaking", "overall", "timestamp"]
    },
    {
      name: "Fitness",
      headers: ["id", "date", "gym_status", "weight_kg", "bmi", "timestamp"]
    },
    {
      name: "WeightHistory",
      headers: ["id", "date", "weight_kg", "bmi", "timestamp"]
    },
    {
      name: "Sleep",
      headers: ["id", "date", "duration_hours", "bedtime", "waketime", "timestamp"]
    },
    {
      name: "Commitments",
      headers: ["id", "created_date", "target_date", "text", "status", "timestamp"]
    },
    {
      name: "Pomodoro",
      headers: ["id", "date", "category", "focus_minutes", "retrieval_minutes", "restful_minutes", "status", "timestamp"]
    },
    {
      name: "MonthlyGoals",
      headers: ["id", "month", "goal", "reason", "success_criteria", "completed", "review", "reviewed_at", "updated_at"]
    },
    {
      name: "Goals",
      headers: ["id", "title", "pillar", "target_date", "status", "milestones", "updated_at"]
    },
    {
      name: "DailyReviews",
      headers: ["id", "date", "deen_rating", "cyber_rating", "english_rating", "fitness_rating", "energy_rating", "what_went_well", "what_went_wrong", "what_to_improve", "timestamp"]
    },
    {
      name: "WeeklyReviews",
      headers: ["id", "week_start_date", "week_end_date", "deen_score", "cyber_hours", "english_hours", "gym_count", "avg_sleep", "masjid_prayers", "total_prayers", "biggest_win", "biggest_problem", "biggest_achievement", "biggest_weakness", "next_priority", "next_week_commitments", "timestamp"]
    }
  ];

  schemas.forEach(function(schema) {
    var sheet = ss.getSheetByName(schema.name);
    if (!sheet) {
      sheet = ss.insertSheet(schema.name);
    }

    // Set headers if empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(schema.headers);
      var headerRange = sheet.getRange(1, 1, 1, schema.headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1e2637");
      headerRange.setFontColor("#f1f5f9");
      sheet.setFrozenRows(1);
    }
  });

  // Remove default "Sheet1" if empty and other tabs exist
  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch(e) {}
  }

  Logger.log("BATMAN Database initialization completed successfully. 22 tabs configured.");
}

/**
 * Utility to clear all data rows across all tabs while preserving headers.
 * Run this in Apps Script ONLY if you want to wipe all cloud data and start fresh!
 */
function clearAllSpreadsheetData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  sheets.forEach(function(sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
      Logger.log("Cleared data in sheet: " + sheet.getName());
    }
  });

  Logger.log("All spreadsheet data rows cleared. Column headers preserved.");
}

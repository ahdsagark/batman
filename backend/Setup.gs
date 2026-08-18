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
      headers: ["id", "date", "gym_attended", "weight_kg", "bmi", "timestamp"]
    },
    {
      name: "Sleep",
      headers: ["id", "date", "duration_hours", "bedtime", "waketime", "timestamp"]
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
      headers: ["id", "week_start_date", "deen_score", "cyber_hours", "english_hours", "gym_count", "avg_sleep", "biggest_win", "biggest_problem", "next_priority", "timestamp"]
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

  Logger.log("BATMAN Database initialization completed successfully. 15 tabs configured.");
}

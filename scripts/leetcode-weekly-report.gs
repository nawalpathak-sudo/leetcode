// ===== CONFIG =====
var SUPABASE_URL = 'https://ifkkhwumimawacqaujop.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlma2tod3VtaW1hd2FjcWF1am9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTE3NTksImV4cCI6MjA4NjQ2Nzc1OX0.rmPKoWFi1iJLHyb1ozHgqI75t51alDwTqZZGcnBZu1I';
var SHEET_NAME = 'LeetCode Weekly';

// ===== RUN THIS ONCE to set up Monday 12pm IST trigger =====
function setupWeeklyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'generateReport') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('generateReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(7) // 7 UTC = 12:30 IST
    .create();
}

// ===== MAIN =====
function generateReport() {
  var data = fetchFromView();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) { sheet.clear(); } else { sheet = ss.insertSheet(SHEET_NAME); }

  var weeks = [3, 2, 1, 0].map(function(w) { return getWeekRange(w); });

  // Fetch activity data from daily_snapshots via the leetcode_activity_view
  var activityMap = fetchActivityView();

  var headers = [
    '#', 'Student Name', 'Campus', 'Batch', 'LeetCode Username',
    'Problems 7d', 'Problems 30d',
    weeks[0].label, weeks[1].label, weeks[2].label, weeks[3].label,
    'YTD Easy', 'YTD Medium', 'YTD Hard', 'YTD Total'
  ];

  var rows = data.map(function(p) {
    var act = activityMap[p.lead_id] || { problems_7d: 0, problems_30d: 0 };
    return {
      name: p.student_name || '',
      campus: p.college || '',
      batch: p.batch || '',
      username: p.username || '',
      problems_7d: act.problems_7d || 0,
      problems_30d: act.problems_30d || 0,
      w3: countInRange(p.submission_calendar, weeks[0].start, weeks[0].end),
      w2: countInRange(p.submission_calendar, weeks[1].start, weeks[1].end),
      w1: countInRange(p.submission_calendar, weeks[2].start, weeks[2].end),
      w0: countInRange(p.submission_calendar, weeks[3].start, weeks[3].end),
      easy: p.easy || 0,
      med: p.medium || 0,
      hard: p.hard || 0,
      total: p.total || 0
    };
  });

  rows.sort(function(a, b) { return b.total - a.total; });

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (rows.length > 0) {
    var values = rows.map(function(r, i) {
      return [i + 1, r.name, r.campus, r.batch, r.username, r.problems_7d, r.problems_30d, r.w3, r.w2, r.w1, r.w0, r.easy, r.med, r.hard, r.total];
    });
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }

  formatSheet(sheet, rows.length, headers.length);

  // ===== CAMPUS × BATCH MONTHLY SUMMARY =====
  generateMonthlySummary(ss, data);

  Logger.log('Done. ' + rows.length + ' students processed.');
  return rows.length;
}

// ===== CAMPUS × BATCH MONTHLY SUMMARY =====
function generateMonthlySummary(ss, data) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!data || !Array.isArray(data)) data = fetchFromView();
  if (!data || !Array.isArray(data)) { Logger.log('ERROR: fetchFromView returned: ' + JSON.stringify(data)); return; }
  Logger.log('Monthly summary: ' + data.length + ' profiles loaded');
  var SUMMARY_SHEET = 'Monthly Summary';
  var sheet = ss.getSheetByName(SUMMARY_SHEET);
  if (sheet) { sheet.clear(); } else { sheet = ss.insertSheet(SUMMARY_SHEET); }

  // Build month ranges: last 4 months + current month
  var months = getMonthRanges(5);

  // Group students by campus × batch
  var groups = {};
  data.forEach(function(p) {
    var campus = p.college || 'Unknown';
    var batch = p.batch || 'Unknown';
    var key = campus + '|||' + batch;
    if (!groups[key]) {
      groups[key] = { campus: campus, batch: batch, students: [] };
    }
    groups[key].students.push(p);
  });

  // Headers
  var headers = ['Campus', 'Batch', 'Students'];
  months.forEach(function(m) { headers.push(m.label); });
  headers.push('Total Now');

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Build rows
  var keys = Object.keys(groups).sort();
  var rows = keys.map(function(key) {
    var g = groups[key];
    var row = [g.campus, g.batch, g.students.length];

    months.forEach(function(m) {
      var total = 0;
      g.students.forEach(function(p) {
        total += countInRange(p.submission_calendar, m.start, m.end);
      });
      row.push(total);
    });

    // Total Now = sum of all YTD totals
    var ytdTotal = 0;
    g.students.forEach(function(p) { ytdTotal += (p.total || 0); });
    row.push(ytdTotal);

    return row;
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // ===== FORMATTING =====
  var lastRow = rows.length + 1;
  var lastCol = headers.length;

  // Header
  sheet.getRange(1, 1, 1, lastCol)
    .setFontWeight('bold').setBackground('#0D1E56').setFontColor('#FFFFFF')
    .setHorizontalAlignment('center').setWrap(true).setFontSize(10);
  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 70);
  sheet.setColumnWidth(3, 80);
  for (var c = 4; c <= lastCol; c++) sheet.setColumnWidth(c, 90);

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).setFontSize(10);
    sheet.getRange(2, 3, lastRow - 1, lastCol - 2).setHorizontalAlignment('center');

    // Bold Total Now column
    sheet.getRange(2, lastCol, lastRow - 1, 1).setFontWeight('bold');

    // Alternating rows
    for (var i = 2; i <= lastRow; i++) {
      if (i % 2 === 0) sheet.getRange(i, 1, 1, lastCol).setBackground('#F8FAFC');
    }

    // Conditional formatting on month columns
    var rules = [];
    for (var col = 4; col <= lastCol; col++) {
      var r = sheet.getRange(2, col, lastRow - 1, 1);
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .setGradientMaxpointWithValue('#22ACD1', SpreadsheetApp.InterpolationType.MAX, '')
        .setGradientMidpointWithValue('#E0F7FA', SpreadsheetApp.InterpolationType.PERCENTILE, '50')
        .setGradientMinpointWithValue('#FFFFFF', SpreadsheetApp.InterpolationType.MIN, '')
        .setRanges([r]).build());
    }
    sheet.setConditionalFormatRules(rules);

    // Grand total row
    var sr = lastRow + 1;
    sheet.getRange(sr, 1).setValue('TOTAL').setFontWeight('bold');
    sheet.getRange(sr, 3).setFormula('=SUM(C2:C' + lastRow + ')').setFontWeight('bold');
    for (var c = 4; c <= lastCol; c++) {
      sheet.getRange(sr, c).setFormula('=SUM(' + colLetter(c) + '2:' + colLetter(c) + lastRow + ')').setFontWeight('bold');
    }
    sheet.getRange(sr, 1, 1, lastCol).setBackground('#F1F5F9').setBorder(true, null, null, null, null, null, '#CBD5E1', SpreadsheetApp.BorderStyle.SOLID);
  }

  sheet.getRange(1, 1, 1, lastCol).setBorder(null, null, true, null, null, null, '#0D1E56', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

function getMonthRanges(count) {
  var months = [];
  var now = new Date();
  for (var i = count - 1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var start = new Date(d.getFullYear(), d.getMonth(), 1);
    var end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    months.push({
      label: Utilities.formatDate(start, 'Asia/Kolkata', 'MMM-yy'),
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000)
    });
  }
  return months;
}

// ===== DATA FETCH — single API call via DB view =====
function fetchFromView() {
  // Uses the leetcode_weekly_view which pre-extracts stats from raw_json server-side
  // Only fetches: username, student_name, college, batch, easy, medium, hard, total, submission_calendar
  // No raw_json transferred — ~100x smaller payload
  var all = [];
  var offset = 0;
  var limit = 1000;

  while (true) {
    var url = SUPABASE_URL + '/rest/v1/leetcode_weekly_view?select=lead_id,username,student_name,college,batch,easy,medium,hard,total,submission_calendar&offset=' + offset + '&limit=' + limit;
    var res = UrlFetchApp.fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
      muteHttpExceptions: true
    });
    var batch = JSON.parse(res.getContentText());
    if (!Array.isArray(batch) || batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return all;
}

// ===== FETCH ACTIVITY FROM daily_snapshots VIEW =====
function fetchActivityView() {
  var map = {};
  var offset = 0;
  var limit = 1000;
  while (true) {
    var url = SUPABASE_URL + '/rest/v1/leetcode_activity_view?select=lead_id,problems_7d,problems_30d&offset=' + offset + '&limit=' + limit;
    var res = UrlFetchApp.fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
      muteHttpExceptions: true
    });
    var batch = JSON.parse(res.getContentText());
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (var i = 0; i < batch.length; i++) {
      map[batch[i].lead_id] = batch[i];
    }
    if (batch.length < limit) break;
    offset += limit;
  }
  return map;
}

// ===== FORMATTING =====
function formatSheet(sheet, rowCount, colCount) {
  var lastRow = rowCount + 1;

  sheet.getRange(1, 1, 1, colCount)
    .setFontWeight('bold').setBackground('#0D1E56').setFontColor('#FFFFFF')
    .setHorizontalAlignment('center').setWrap(true).setFontSize(9);
  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 40);   // #
  sheet.setColumnWidth(2, 180);  // Student Name
  sheet.setColumnWidth(3, 80);   // Campus
  sheet.setColumnWidth(4, 60);   // Batch
  sheet.setColumnWidth(5, 140);  // Username
  sheet.setColumnWidth(6, 90);   // Problems 7d
  sheet.setColumnWidth(7, 90);   // Problems 30d
  for (var c = 8; c <= 11; c++) sheet.setColumnWidth(c, 120); // Weekly columns
  sheet.setColumnWidth(12, 75);  // Easy
  sheet.setColumnWidth(13, 85);  // Medium
  sheet.setColumnWidth(14, 65);  // Hard
  sheet.setColumnWidth(15, 75);  // Total

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, colCount).setFontSize(9);
    sheet.getRange(2, 6, lastRow - 1, 10).setHorizontalAlignment('center');
    sheet.getRange(2, 1, lastRow - 1, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 15, lastRow - 1, 1).setFontWeight('bold');
  }

  for (var i = 2; i <= lastRow; i++) {
    if (i % 2 === 0) sheet.getRange(i, 1, 1, colCount).setBackground('#F8FAFC');
  }

  if (lastRow > 1) {
    var rules = [];
    // Problems 7d/30d columns (6,7) + weekly columns (8-11)
    for (var col = 6; col <= 11; col++) {
      var wr = sheet.getRange(2, col, lastRow - 1, 1);
      rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberEqualTo(0).setBackground('#FEE2E2').setFontColor('#EF4444').setRanges([wr]).build());
      rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground('#DCFCE7').setFontColor('#16A34A').setRanges([wr]).build());
    }
    rules.push(SpreadsheetApp.newConditionalFormatRule().setGradientMaxpointWithValue('#DCFCE7', SpreadsheetApp.InterpolationType.MAX, '').setGradientMinpointWithValue('#FFFFFF', SpreadsheetApp.InterpolationType.MIN, '').setRanges([sheet.getRange(2, 12, lastRow - 1, 1)]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().setGradientMaxpointWithValue('#FEF3C7', SpreadsheetApp.InterpolationType.MAX, '').setGradientMinpointWithValue('#FFFFFF', SpreadsheetApp.InterpolationType.MIN, '').setRanges([sheet.getRange(2, 13, lastRow - 1, 1)]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().setGradientMaxpointWithValue('#FEE2E2', SpreadsheetApp.InterpolationType.MAX, '').setGradientMinpointWithValue('#FFFFFF', SpreadsheetApp.InterpolationType.MIN, '').setRanges([sheet.getRange(2, 14, lastRow - 1, 1)]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().setGradientMaxpointWithValue('#22ACD1', SpreadsheetApp.InterpolationType.MAX, '').setGradientMidpointWithValue('#E0F7FA', SpreadsheetApp.InterpolationType.PERCENTILE, '50').setGradientMinpointWithValue('#FFFFFF', SpreadsheetApp.InterpolationType.MIN, '').setRanges([sheet.getRange(2, 15, lastRow - 1, 1)]).build());
    sheet.setConditionalFormatRules(rules);
  }

  sheet.getRange(1, 1, 1, colCount).setBorder(null, null, true, null, null, null, '#0D1E56', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  if (lastRow > 1) {
    var sr = lastRow + 1;
    sheet.getRange(sr, 2).setValue('TOTAL / AVG').setFontWeight('bold');
    for (var c = 6; c <= 11; c++) sheet.getRange(sr, c).setFormula('=SUM(' + colLetter(c) + '2:' + colLetter(c) + lastRow + ')').setFontWeight('bold');
    for (var c = 12; c <= 15; c++) sheet.getRange(sr, c).setFormula('=ROUND(AVERAGE(' + colLetter(c) + '2:' + colLetter(c) + lastRow + '),1)').setFontWeight('bold');
    sheet.getRange(sr, 1, 1, colCount).setBackground('#F1F5F9').setBorder(true, null, null, null, null, null, '#CBD5E1', SpreadsheetApp.BorderStyle.SOLID);
  }
}

// ===== HELPERS =====
function getWeekRange(weeksAgo) {
  var now = new Date();
  var monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1 - (weeksAgo * 7));
  monday.setHours(0, 0, 0, 0);
  var sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: Math.floor(monday.getTime() / 1000),
    end: Math.floor(sunday.getTime() / 1000),
    label: Utilities.formatDate(monday, 'Asia/Kolkata', 'dd MMM') + ' – ' + Utilities.formatDate(sunday, 'Asia/Kolkata', 'dd MMM')
  };
}

function countInRange(calStr, startTs, endTs) {
  if (!calStr) return 0;
  try {
    var cal = JSON.parse(calStr);
    var count = 0;
    var keys = Object.keys(cal);
    for (var i = 0; i < keys.length; i++) {
      var t = parseInt(keys[i]);
      if (t >= startTs && t <= endTs) count += cal[keys[i]];
    }
    return count;
  } catch (e) { return 0; }
}

function colLetter(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

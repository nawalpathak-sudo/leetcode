import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://ifkkhwumimawacqaujop.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlma2tod3VtaW1hd2FjcWF1am9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5MTc1OSwiZXhwIjoyMDg2NDY3NzU5fQ.BB3cqEO73Oot2ovkPRZ8l3eTxnq7ltJB1PtMmbh98RQ"
);

const { data, error } = await supabase
  .from("coding_profiles")
  .select("raw_json, stats, fetched_at, username")
  .eq("platform", "leetcode")
  .limit(3);

if (error) {
  console.error("Query error:", error);
  process.exit(1);
}

console.log(`Fetched ${data.length} rows\n`);

for (const row of data) {
  console.log("=".repeat(80));
  console.log(`Username: ${row.username} | fetched_at: ${row.fetched_at}`);
  console.log("=".repeat(80));

  const raw = row.raw_json;
  if (!raw) {
    console.log("  raw_json is NULL\n");
    continue;
  }

  // 1. Top-level keys
  const topKeys = Object.keys(raw);
  console.log(`\n  Top-level keys (${topKeys.length}):`, topKeys);

  // 2. submissionCalendar
  if ("submissionCalendar" in raw) {
    let cal = raw.submissionCalendar;
    if (typeof cal === "string") {
      try { cal = JSON.parse(cal); } catch { /* keep as-is */ }
    }
    if (typeof cal === "object" && cal !== null) {
      const entries = Object.entries(cal);
      console.log(`\n  submissionCalendar: ${entries.length} entries (object/map of unix_ts -> count)`);
      const sample = entries.slice(0, 3);
      for (const [ts, count] of sample) {
        console.log(`    ${ts} -> ${count}  (${new Date(Number(ts) * 1000).toISOString().slice(0, 10)})`);
      }

      // Group by month
      const monthly = {};
      for (const [ts, count] of entries) {
        const d = new Date(Number(ts) * 1000);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthly[key] = (monthly[key] || 0) + Number(count);
      }
      const sortedMonths = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0]));
      console.log(`\n  Monthly breakdown from submissionCalendar (${sortedMonths.length} months):`);
      for (const [month, count] of sortedMonths) {
        console.log(`    ${month}: ${count} submissions`);
      }
    } else {
      console.log(`\n  submissionCalendar exists but is type: ${typeof cal}`, String(cal).slice(0, 200));
    }
  } else {
    console.log("\n  submissionCalendar: NOT FOUND");
  }

  // 3. recentAcSubmissionList
  if ("recentAcSubmissionList" in raw) {
    const list = raw.recentAcSubmissionList;
    if (Array.isArray(list) && list.length > 0) {
      const timestamps = list.map(e => Number(e.timestamp)).filter(t => !isNaN(t));
      timestamps.sort((a, b) => a - b);
      console.log(`\n  recentAcSubmissionList: ${list.length} entries`);
      console.log(`    Sample keys:`, Object.keys(list[0]));
      console.log(`    Earliest: ${new Date(timestamps[0] * 1000).toISOString()}`);
      console.log(`    Latest:   ${new Date(timestamps[timestamps.length - 1] * 1000).toISOString()}`);
    } else {
      console.log(`\n  recentAcSubmissionList: ${Array.isArray(list) ? "empty array" : typeof list}`);
    }
  } else {
    console.log("\n  recentAcSubmissionList: NOT FOUND");
  }

  // 4. recentSubmissionList
  if ("recentSubmissionList" in raw) {
    const list = raw.recentSubmissionList;
    if (Array.isArray(list) && list.length > 0) {
      const timestamps = list.map(e => Number(e.timestamp)).filter(t => !isNaN(t));
      timestamps.sort((a, b) => a - b);
      console.log(`\n  recentSubmissionList: ${list.length} entries`);
      console.log(`    Sample keys:`, Object.keys(list[0]));
      console.log(`    Earliest: ${new Date(timestamps[0] * 1000).toISOString()}`);
      console.log(`    Latest:   ${new Date(timestamps[timestamps.length - 1] * 1000).toISOString()}`);
    } else {
      console.log(`\n  recentSubmissionList: ${Array.isArray(list) ? "empty array" : typeof list}`);
    }
  } else {
    console.log("\n  recentSubmissionList: NOT FOUND");
  }

  console.log("\n");
}

import { createClient } from '@/lib/supabase/server';
import WeeklyReportClient from './_components/WeeklyReportClient';

async function fetchAllProfiles(supabase: any) {
  const profiles: any[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('coding_profiles')
      .select('username, raw_json, students(student_name, college, batch)')
      .eq('platform', 'leetcode')
      .not('raw_json', 'is', null)
      .range(offset, offset + batchSize - 1);

    if (error || !data || data.length === 0) break;
    profiles.push(...data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }
  return profiles;
}

function getWeekRange(weeksAgo: number) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1 - (weeksAgo * 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return {
    start: Math.floor(monday.getTime() / 1000),
    end: Math.floor(sunday.getTime() / 1000),
    label: `${fmt(monday)} – ${fmt(sunday)}`
  };
}

function countInRange(calendarStr: string | null, start: number, end: number): number {
  if (!calendarStr) return 0;
  try {
    const cal = JSON.parse(calendarStr);
    let count = 0;
    for (const [ts, c] of Object.entries(cal)) {
      const t = parseInt(ts);
      if (t >= start && t <= end) count += (c as number);
    }
    return count;
  } catch { return 0; }
}

export default async function WeeklyReportPage() {
  const supabase = await createClient();
  const profiles = await fetchAllProfiles(supabase);

  const weeks = [3, 2, 1, 0].map(w => getWeekRange(w));

  const rows = profiles.map((p: any) => {
    const user = p.raw_json?.matchedUser || {};
    const stats = user.submitStats?.acSubmissionNum || [];
    const calendar = user.submissionCalendar || null;

    const easy = stats.find((s: any) => s.difficulty === 'Easy')?.count || 0;
    const med = stats.find((s: any) => s.difficulty === 'Medium')?.count || 0;
    const hard = stats.find((s: any) => s.difficulty === 'Hard')?.count || 0;
    const total = stats.find((s: any) => s.difficulty === 'All')?.count || 0;

    return {
      name: p.students?.student_name || '',
      campus: p.students?.college || '',
      batch: p.students?.batch || '',
      username: p.username || '',
      w3: countInRange(calendar, weeks[0].start, weeks[0].end),
      w2: countInRange(calendar, weeks[1].start, weeks[1].end),
      w1: countInRange(calendar, weeks[2].start, weeks[2].end),
      w0: countInRange(calendar, weeks[3].start, weeks[3].end),
      easy,
      med,
      hard,
      total,
    };
  });

  const weekLabels = weeks.map(w => w.label);

  return <WeeklyReportClient rows={rows} weekLabels={weekLabels} />;
}

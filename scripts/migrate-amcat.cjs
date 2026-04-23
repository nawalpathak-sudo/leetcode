// Migrate all AMCAT data from old Supabase to main Supabase
// Run: node scripts/migrate-amcat.js

const { createClient } = require('@supabase/supabase-js');

const OLD = createClient(
  'https://mquragfkeuzdwdwzaahp.supabase.co',
  'sb_publishable_lfimyYYB8CkPSgK2P-Hh-A_XU0d3epS'
);

const NEW = createClient(
  'https://ifkkhwumimawacqaujop.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlma2tod3VtaW1hd2FjcWF1am9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5MTc1OSwiZXhwIjoyMDg2NDY3NzU5fQ.BB3cqEO73Oot2ovkPRZ8l3eTxnq7ltJB1PtMmbh98RQ'
);

async function migrate() {
  console.log('Fetching from old AMCAT DB...');

  // 1. Assessments
  const { data: assessments, error: ae } = await OLD.from('assessments').select('*').order('id');
  if (ae) { console.error('Failed to fetch assessments:', ae.message); return; }
  console.log(`  Assessments: ${assessments.length}`);

  // 2. AMCAT Results
  const { data: amcatResults, error: are } = await OLD.from('amcat_results').select('*').order('id');
  if (are) { console.error('Failed to fetch amcat_results:', are.message); return; }
  console.log(`  AMCAT Results: ${amcatResults.length}`);

  // 3. SVAR Results
  const { data: svarResults, error: sre } = await OLD.from('svar_results').select('*').order('id');
  if (sre) { console.error('Failed to fetch svar_results:', sre.message); return; }
  console.log(`  SVAR Results: ${svarResults.length}`);

  // Insert into new DB
  console.log('\nInserting into main DB...');

  // Assessments — map old id to new id
  const idMap = {};
  for (const a of assessments) {
    const { data, error } = await NEW.from('amcat_assessments').upsert({
      id: a.id,
      assessment_name: a.assessment_name,
      campus_id: a.campus_id,
      batch_id: a.batch_id,
      category_id: a.category_id,
      test_date: a.test_date,
      is_done: a.is_done,
      is_historical: a.is_historical,
      indicative_date: a.indicative_date,
      category_ids: a.category_ids,
      created_at: a.created_at
    }, { onConflict: 'id' }).select();
    if (error) console.error(`  Assessment ${a.id} error:`, error.message);
    else idMap[a.id] = data[0].id;
  }
  console.log(`  Assessments inserted: ${Object.keys(idMap).length}`);

  // AMCAT Results — batch insert
  const amcatBatches = [];
  for (let i = 0; i < amcatResults.length; i += 100) {
    const batch = amcatResults.slice(i, i + 100).map(r => {
      const { id, ...rest } = r; // remove old id, let serial auto-generate
      return { ...rest, assessment_id: idMap[r.assessment_id] || r.assessment_id };
    });
    const { error } = await NEW.from('amcat_results').insert(batch);
    if (error) console.error(`  AMCAT batch ${i} error:`, error.message);
    else amcatBatches.push(batch.length);
  }
  console.log(`  AMCAT Results inserted: ${amcatBatches.reduce((a, b) => a + b, 0)}`);

  // SVAR Results — batch insert
  const svarBatches = [];
  for (let i = 0; i < svarResults.length; i += 100) {
    const batch = svarResults.slice(i, i + 100).map(r => {
      const { id, ...rest } = r;
      return { ...rest, assessment_id: idMap[r.assessment_id] || r.assessment_id };
    });
    const { error } = await NEW.from('svar_results').insert(batch);
    if (error) console.error(`  SVAR batch ${i} error:`, error.message);
    else svarBatches.push(batch.length);
  }
  console.log(`  SVAR Results inserted: ${svarBatches.reduce((a, b) => a + b, 0)}`);

  console.log('\nDone! Verify counts:');
  const [ac, ar, sr] = await Promise.all([
    NEW.from('amcat_assessments').select('*', { count: 'exact', head: true }),
    NEW.from('amcat_results').select('*', { count: 'exact', head: true }),
    NEW.from('svar_results').select('*', { count: 'exact', head: true }),
  ]);
  console.log(`  amcat_assessments: ${ac.count}`);
  console.log(`  amcat_results: ${ar.count}`);
  console.log(`  svar_results: ${sr.count}`);
}

migrate().catch(console.error);

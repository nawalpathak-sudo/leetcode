import { supabase } from './supabase'

// --- BOS Templates ---

export async function loadBOSList() {
  const { data } = await supabase
    .from('bos')
    .select('*, bos_subjects(count), bos_assignments(count)')
    .order('name')

  return data || []
}

export async function loadBOS(id) {
  const { data } = await supabase.from('bos').select('*').eq('id', id).single()
  return data
}

export async function createBOS({ name, program, total_semesters, notes }) {
  const { data, error } = await supabase
    .from('bos')
    .insert({ name, program: program || 'B.Tech', total_semesters: parseInt(total_semesters || 8), notes })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBOS(id, fields) {
  const { error } = await supabase.from('bos').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteBOS(id) {
  const { error } = await supabase.from('bos').delete().eq('id', id)
  if (error) throw error
}

// --- BOS Subjects ---

export async function loadBOSSubjects(bosId) {
  const { data } = await supabase
    .from('bos_subjects')
    .select('*, bos_subject_categories(code, name)')
    .eq('bos_id', bosId)
    .order('semester')
    .order('subject_code')
  return data || []
}

export async function createBOSSubject(subject) {
  const { data, error } = await supabase
    .from('bos_subjects')
    .insert(subject)
    .select('*, bos_subject_categories(code, name)')
    .single()
  if (error) throw error
  return data
}

export async function updateBOSSubject(id, fields) {
  const { data, error } = await supabase
    .from('bos_subjects')
    .update(fields)
    .eq('id', id)
    .select('*, bos_subject_categories(code, name)')
    .single()
  if (error) throw error
  return data
}

export async function deleteBOSSubject(id) {
  const { error } = await supabase.from('bos_subjects').delete().eq('id', id)
  if (error) throw error
}

// --- BOS Assignments ---

export async function loadBOSAssignments(bosId) {
  const { data } = await supabase
    .from('bos_assignments')
    .select('*')
    .eq('bos_id', bosId)
    .order('campus_name')
    .order('admission_year', { ascending: false })
  return data || []
}

export async function createBOSAssignment({ bos_id, campus_name, admission_year, current_semester }) {
  const { data, error } = await supabase
    .from('bos_assignments')
    .insert({ bos_id, campus_name, admission_year: parseInt(admission_year), current_semester: parseInt(current_semester || 1) })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBOSAssignment(id, fields) {
  const { error } = await supabase.from('bos_assignments').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteBOSAssignment(id) {
  const { error } = await supabase.from('bos_assignments').delete().eq('id', id)
  if (error) throw error
}

// --- Categories ---

export async function loadCategories() {
  const { data } = await supabase.from('bos_subject_categories').select('id, code, name').order('code')
  return data || []
}

// --- Helpers ---

// L-T-P is stored as HOURS per week
// Credits: L + T + P/2 (1 practical hour = 0.5 credit)
// Hours: L + T + P (as-is, already hours)
export function computeCredits(l, t, p) {
  const theoryCredits = (l || 0) + (t || 0)
  const practicalCredits = Math.floor((p || 0) / 2)
  const totalCredits = theoryCredits + practicalCredits
  const hours = (l || 0) + (t || 0) + (p || 0)
  return { theory: theoryCredits, practical: practicalCredits, total: totalCredits, hours }
}

export function semesterSummary(subjects, sem) {
  const semSubjects = subjects.filter(s => s.semester === sem)
  return {
    count: semSubjects.length,
    totalCredits: semSubjects.reduce((s, r) => s + (r.total_credits || 0), 0),
    totalContact: semSubjects.reduce((s, r) => s + (r.lecture_hours || 0) + (r.tutorial_hours || 0) + (r.practical_hours || 0), 0),
    theoryCredits: semSubjects.reduce((s, r) => s + (r.theory_credits || 0), 0),
    practicalCredits: semSubjects.reduce((s, r) => s + (r.practical_credits || 0), 0),
  }
}

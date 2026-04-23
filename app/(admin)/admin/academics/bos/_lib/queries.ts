import { SupabaseClient } from '@supabase/supabase-js'

// --- Types ---

export interface BOS {
  id: string
  name: string
  program: string
  total_semesters: number
  status: 'draft' | 'approved' | 'archived'
  notes?: string
  bos_subjects?: [{ count: number }]
  bos_assignments?: [{ count: number }]
}

export interface BOSSubject {
  id: string
  bos_id: string
  semester: number
  subject_code: string
  subject_name: string
  category_id?: string
  lecture_hours: number
  tutorial_hours: number
  practical_hours: number
  total_credits?: number
  theory_credits?: number
  practical_credits?: number
  is_elective?: boolean
  is_audit?: boolean
  topics?: string[]
  bos_subject_categories?: { code: string; name: string } | null
}

export interface BOSAssignment {
  id: string
  bos_id: string
  campus_name: string
  admission_year: number
  current_semester: number
}

export interface BOSCategory {
  id: string
  code: string
  name: string
}

// --- BOS List (server) ---

export async function fetchBOSList(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('bos')
    .select('*, bos_subjects(count), bos_assignments(count)')
    .order('name')
  return (data || []) as BOS[]
}

// --- BOS Detail (server) ---

export async function fetchBOS(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from('bos').select('*').eq('id', id).single()
  return data as BOS | null
}

export async function fetchBOSSubjects(supabase: SupabaseClient, bosId: string) {
  const { data } = await supabase
    .from('bos_subjects')
    .select('*, bos_subject_categories(code, name)')
    .eq('bos_id', bosId)
    .order('semester')
    .order('subject_code')
  return (data || []) as BOSSubject[]
}

export async function fetchBOSAssignments(supabase: SupabaseClient, bosId: string) {
  const { data } = await supabase
    .from('bos_assignments')
    .select('*')
    .eq('bos_id', bosId)
    .order('campus_name')
    .order('admission_year', { ascending: false })
  return (data || []) as BOSAssignment[]
}

export async function fetchCategories(supabase: SupabaseClient) {
  const { data } = await supabase.from('bos_subject_categories').select('id, code, name').order('code')
  return (data || []) as BOSCategory[]
}

// --- Mutations (client-side) ---

export async function createBOS(supabase: SupabaseClient, fields: { name: string; program: string; total_semesters: number; notes?: string }) {
  const { data, error } = await supabase
    .from('bos')
    .insert({ name: fields.name, program: fields.program || 'B.Tech', total_semesters: fields.total_semesters || 8, notes: fields.notes })
    .select()
    .single()
  if (error) throw error
  return data as BOS
}

export async function updateBOS(supabase: SupabaseClient, id: string, fields: Record<string, unknown>) {
  const { error } = await supabase.from('bos').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteBOS(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('bos').delete().eq('id', id)
  if (error) throw error
}

export async function createBOSSubject(supabase: SupabaseClient, subject: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('bos_subjects')
    .insert(subject)
    .select('*, bos_subject_categories(code, name)')
    .single()
  if (error) throw error
  return data as BOSSubject
}

export async function updateBOSSubject(supabase: SupabaseClient, id: string, fields: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('bos_subjects')
    .update(fields)
    .eq('id', id)
    .select('*, bos_subject_categories(code, name)')
    .single()
  if (error) throw error
  return data as BOSSubject
}

export async function deleteBOSSubject(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('bos_subjects').delete().eq('id', id)
  if (error) throw error
}

export async function createBOSAssignment(supabase: SupabaseClient, fields: { bos_id: string; campus_name: string; admission_year: number; current_semester: number }) {
  const { data, error } = await supabase
    .from('bos_assignments')
    .insert({ bos_id: fields.bos_id, campus_name: fields.campus_name, admission_year: fields.admission_year, current_semester: fields.current_semester || 1 })
    .select()
    .single()
  if (error) throw error
  return data as BOSAssignment
}

export async function updateBOSAssignment(supabase: SupabaseClient, id: string, fields: Record<string, unknown>) {
  const { error } = await supabase.from('bos_assignments').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteBOSAssignment(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('bos_assignments').delete().eq('id', id)
  if (error) throw error
}

// --- Campuses / Batches for assign modal ---

export async function fetchCampuses(supabase: SupabaseClient) {
  const { data } = await supabase.from('master_campuses').select('id, name').eq('active', true).order('name')
  return data || []
}

export async function fetchBatches(supabase: SupabaseClient, campusId: string) {
  const { data } = await supabase
    .from('master_batches')
    .select('id, admission_year')
    .eq('campus_id', campusId)
    .eq('active', true)
    .order('admission_year', { ascending: false })
  return data || []
}

// --- Helpers ---

export function computeCredits(l: number, t: number, p: number) {
  const theoryCredits = (l || 0) + (t || 0)
  const practicalCredits = Math.floor((p || 0) / 2)
  const totalCredits = theoryCredits + practicalCredits
  const hours = (l || 0) + (t || 0) + (p || 0)
  return { theory: theoryCredits, practical: practicalCredits, total: totalCredits, hours }
}

export function semesterSummary(subjects: BOSSubject[], sem: number) {
  const semSubjects = subjects.filter(s => s.semester === sem)
  return {
    count: semSubjects.length,
    totalCredits: semSubjects.reduce((s, r) => s + (r.total_credits || 0), 0),
    totalContact: semSubjects.reduce((s, r) => s + (r.lecture_hours || 0) + (r.tutorial_hours || 0) + (r.practical_hours || 0), 0),
    theoryCredits: semSubjects.reduce((s, r) => s + (r.theory_credits || 0), 0),
    practicalCredits: semSubjects.reduce((s, r) => s + (r.practical_credits || 0), 0),
  }
}

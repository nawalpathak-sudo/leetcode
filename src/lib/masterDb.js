import { supabase } from './supabase'

// --- Campuses ---

export async function loadCampuses(activeOnly = true) {
  let query = supabase.from('master_campuses').select('*').order('name')
  if (activeOnly) query = query.eq('active', true)
  const { data } = await query
  return data || []
}

export async function createCampus({ name, code, city }) {
  const { data, error } = await supabase
    .from('master_campuses')
    .insert({ name, code: code || name, city })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCampus(id, fields) {
  const { error } = await supabase.from('master_campuses').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteCampus(id) {
  const { error } = await supabase.from('master_campuses').delete().eq('id', id)
  if (error) throw error
}

// --- Batches ---

export async function loadBatches(campusId, activeOnly = true) {
  let query = supabase
    .from('master_batches')
    .select('*, master_campuses(name)')
    .order('admission_year', { ascending: false })

  if (campusId) query = query.eq('campus_id', campusId)
  if (activeOnly) query = query.eq('active', true)

  const { data } = await query
  return data || []
}

export async function createBatch({ campus_id, admission_year, program }) {
  const { data, error } = await supabase
    .from('master_batches')
    .insert({ campus_id, admission_year: parseInt(admission_year), program: program || 'B.Tech' })
    .select('*, master_campuses(name)')
    .single()
  if (error) throw error
  return data
}

export async function deleteBatch(id) {
  const { error } = await supabase.from('master_batches').delete().eq('id', id)
  if (error) throw error
}

// --- Combined loader for dropdowns ---

export async function loadCampusAndBatches() {
  const [campuses, batches] = await Promise.all([
    loadCampuses(),
    loadBatches(null),
  ])

  const batchesByCampus = {}
  batches.forEach(b => {
    const campusName = b.master_campuses?.name
    if (!campusName) return
    if (!batchesByCampus[campusName]) batchesByCampus[campusName] = []
    batchesByCampus[campusName].push(b)
  })

  return { campuses, batches, batchesByCampus }
}

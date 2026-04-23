import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// AMCAT Supabase (separate project)
const amcatUrl = import.meta.env.VITE_AMCAT_SUPABASE_URL
const amcatKey = import.meta.env.VITE_AMCAT_SUPABASE_ANON_KEY

export const amcatSupabase = (amcatUrl && amcatKey) ? createClient(amcatUrl, amcatKey) : null

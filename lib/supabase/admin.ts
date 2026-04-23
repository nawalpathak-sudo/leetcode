import { createClient } from '@supabase/supabase-js'

// Service role client — ONLY for API routes and server actions
// Never import this in client components
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

import { createClient } from '@/lib/supabase/server'
import HomepageCMS from './_components/HomepageCMS'

export default async function CMSPage() {
  const supabase = await createClient()

  const { data: sections } = await supabase
    .from('cms_sections')
    .select('*')
    .order('sort_order', { ascending: true })
    .limit(50)

  return <HomepageCMS initialSections={sections || []} />
}

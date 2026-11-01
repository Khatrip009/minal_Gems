import { requireRole } from '@/lib/guard'
import { HeroSlidesClient } from './hero-slides-client'

export const dynamic = 'force-dynamic'

export default async function HeroSlidesPage() {
  const { supabase } = await requireRole(['admin', 'manager'])

  const { data: slides, error } = await supabase
    .from('hero_slides')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <p className="font-semibold">Failed to load hero slides</p>
        <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs">
          {error.message}
        </pre>
        <p className="mt-2 text-xs">
          If the error mentions <code>hero_slides</code> not existing, run the
          create-table SQL from the setup message first.
        </p>
      </div>
    )
  }

  return <HeroSlidesClient initialSlides={slides ?? []} />
}
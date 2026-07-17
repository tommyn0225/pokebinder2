import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import HoldingsList from './HoldingsList'
import BinderValueChart from './BinderValueChart'
import BinderHeaderActions from './BinderHeaderActions'
import DataErrorPanel from '@/components/DataErrorPanel'
import { logError } from '@/lib/logError'
import type { Binder } from '@/types/binder'
import type { Holding } from '@/types/holding'

export default async function BinderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: binder, error: binderError } = await supabase
    .from('binders')
    .select('id, name, game, is_public')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  // .single() returns error code PGRST116 for "no rows" — that's a genuine
  // 404. Any other error is a real DB failure and must not look like a 404.
  if (binderError && binderError.code !== 'PGRST116') {
    logError('binder:page', binderError)
    return (
      <main className="max-w-6xl mx-auto px-6 py-8">
        <DataErrorPanel />
      </main>
    )
  }
  if (!binder) notFound()

  const { data: holdings, error: holdingsError } = await supabase
    .from('holdings')
    .select('id, binder_id, user_id, card_id, game, quantity, finish, for_trade, acquired_price_usd, acquired_at, card_data, created_at')
    .eq('binder_id', id)
    .order('created_at', { ascending: true })

  // A holdings failure must not render as "No cards yet".
  if (holdingsError) {
    logError('binder:page:holdings', holdingsError)
    return (
      <main className="max-w-6xl mx-auto px-6 py-8">
        <DataErrorPanel />
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/dashboard" className="text-muted hover:text-ink transition-colors">
          Dashboard
        </Link>
        <span className="text-muted">/</span>
        <span className="font-semibold text-ink">{binder.name}</span>
        <div className="ml-auto">
          <BinderHeaderActions binderId={binder.id} binderName={binder.name} initialIsPublic={binder.is_public} />
        </div>
      </div>

      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="flex-1 min-w-0">
          <HoldingsList binderId={id} binderGame={binder.game as Binder['game']} binderIsPublic={binder.is_public} initial={(holdings ?? []) as Holding[]} />
        </div>
        <aside className="mt-6 lg:mt-0 lg:w-72 lg:shrink-0">
          <div className="rounded-xl border border-line bg-surface px-4 py-4 lg:sticky lg:top-20">
            <h2 className="microlabel text-muted mb-3">Value over time</h2>
            <BinderValueChart binderId={id} />
          </div>
        </aside>
      </div>
    </main>
  )
}

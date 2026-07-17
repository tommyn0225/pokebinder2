import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BinderList from './BinderList'
import ValueChart from '@/components/ValueChart'
import DataErrorPanel from '@/components/DataErrorPanel'
import { logError } from '@/lib/logError'
import { holdingUnitPrice, summarizeGain } from '@/lib/holdingValue'
import type { Binder } from '@/types/binder'
import type { Holding } from '@/types/holding'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: binders, error: bindersError }, { data: holdings, error: holdingsError }] = await Promise.all([
    supabase
      .from('binders')
      .select('id, name, game, created_at, is_public')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('holdings')
      .select('binder_id, quantity, finish, acquired_price_usd, card_data')
      .eq('user_id', user.id),
  ])

  // A DB failure must never render as an empty collection.
  if (bindersError || holdingsError) {
    logError('dashboard', bindersError ?? holdingsError)
    return (
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-ink mb-6">Your Collection</h1>
        <DataErrorPanel />
      </main>
    )
  }

  const heldCards = (holdings ?? []) as Pick<Holding, 'binder_id' | 'quantity' | 'finish' | 'acquired_price_usd' | 'card_data'>[]
  const binderValueMap = new Map<string, number>()
  let totalUsd = 0
  let totalCards = 0
  for (const h of heldCards) {
    const value = holdingUnitPrice(h) * h.quantity
    binderValueMap.set(h.binder_id, (binderValueMap.get(h.binder_id) ?? 0) + value)
    totalUsd += value
    totalCards += h.quantity
  }
  const gain = summarizeGain(heldCards)

  const bindersWithValue = ((binders ?? []) as (Binder & { is_public: boolean })[]).map(b => ({
    ...b,
    total_usd: Math.round((binderValueMap.get(b.id) ?? 0) * 100) / 100,
  }))

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Your Collection</h1>
          <p className="text-sm text-muted mt-0.5 truncate">{user.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {totalCards > 0 && (
            <a
              href="/api/collection/export"
              download
              className="control-label rounded-md border border-line px-4 py-2 text-ink hover:border-brand hover:text-brand transition-colors"
            >
              Export CSV
            </a>
          )}
          <Link
            href="/trades"
            className="control-label rounded-md border border-line px-4 py-2 text-ink hover:border-brand hover:text-brand transition-colors"
          >
            View trades
          </Link>
        </div>
      </div>

      {/* Stat panel */}
      <div className="mb-6 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface">
        <div className="px-5 py-4">
          <p className="microlabel text-muted">Total value</p>
          <p className="mt-1 font-mono text-2xl text-ink">${totalUsd.toFixed(2)}</p>
          {gain.costed_count > 0 && (
            <p className={`mt-0.5 font-mono text-xs ${
              gain.gain > 0 ? 'text-emerald-600 dark:text-emerald-400'
                : gain.gain < 0 ? 'text-red-600 dark:text-red-400'
                : 'text-muted'
            }`}>
              {gain.gain >= 0 ? '+' : '−'}${Math.abs(gain.gain).toFixed(2)}
              {gain.gain_pct != null ? ` (${gain.gain >= 0 ? '+' : '−'}${Math.abs(gain.gain_pct * 100).toFixed(1)}%)` : ''}
            </p>
          )}
        </div>
        <div className="px-5 py-4">
          <p className="microlabel text-muted">Cards</p>
          <p className="mt-1 font-mono text-2xl text-ink">{totalCards.toLocaleString()}</p>
        </div>
        <div className="px-5 py-4">
          <p className="microlabel text-muted">Binders</p>
          <p className="mt-1 font-mono text-2xl text-ink">{bindersWithValue.length}</p>
        </div>
      </div>

      {/* Collection value over time */}
      <div className="mb-6 rounded-xl border border-line bg-surface px-5 py-4">
        <h2 className="microlabel text-muted mb-1">Collection value over time</h2>
        <ValueChart endpoint="/api/snapshots/collection" height={220} />
      </div>

      <BinderList initial={bindersWithValue} />
    </main>
  )
}

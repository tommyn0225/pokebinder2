import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BinderList from './BinderList'
import type { Binder } from '@/types/binder'
import type { Holding } from '@/types/holding'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: binders }, { data: holdings }] = await Promise.all([
    supabase
      .from('binders')
      .select('id, name, created_at, is_public')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('holdings')
      .select('binder_id, quantity, card_data')
      .eq('user_id', user.id),
  ])

  const binderValueMap = new Map<string, number>()
  let totalUsd = 0
  for (const h of (holdings ?? []) as Pick<Holding, 'binder_id' | 'quantity' | 'card_data'>[]) {
    const value = (h.card_data.price.usd ?? 0) * h.quantity
    binderValueMap.set(h.binder_id, (binderValueMap.get(h.binder_id) ?? 0) + value)
    totalUsd += value
  }

  const bindersWithValue = ((binders ?? []) as (Binder & { is_public: boolean })[]).map(b => ({
    ...b,
    total_usd: Math.round((binderValueMap.get(b.id) ?? 0) * 100) / 100,
  }))

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Your Collection</h1>
        <p className="text-sm text-muted mt-0.5">{user.email}</p>
      </div>

      {/* Stat panel */}
      <div className="mb-6 grid grid-cols-2 divide-x divide-line rounded-xl border border-line bg-surface">
        <div className="px-5 py-4">
          <p className="microlabel text-muted">Total value</p>
          <p className="mt-1 font-mono text-2xl text-ink">${totalUsd.toFixed(2)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="microlabel text-muted">Binders</p>
          <p className="mt-1 font-mono text-2xl text-ink">{String(bindersWithValue.length).padStart(2, '0')}</p>
        </div>
      </div>

      <BinderList initial={bindersWithValue} />
    </main>
  )
}

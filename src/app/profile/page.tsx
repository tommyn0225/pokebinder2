import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { holdingUnitPrice } from '@/lib/holdingValue'
import type { Holding } from '@/types/holding'
import LogoutButton from './LogoutButton'

export default async function ProfilePage() {
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
      .select('binder_id, quantity, finish, card_data')
      .eq('user_id', user.id),
  ])

  const binderValueMap = new Map<string, number>()
  let totalUsd = 0
  for (const h of (holdings ?? []) as Pick<Holding, 'binder_id' | 'quantity' | 'finish' | 'card_data'>[]) {
    const value = holdingUnitPrice(h) * h.quantity
    binderValueMap.set(h.binder_id, (binderValueMap.get(h.binder_id) ?? 0) + value)
    totalUsd += value
  }

  const publicBinders = (binders ?? []).filter(b => b.is_public)
  const totalCards = (holdings ?? []).reduce((sum, h) => sum + h.quantity, 0)
  const joinedYear = new Date(user.created_at).getFullYear()

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      {/* Profile card */}
      <div className="bg-surface border border-line rounded-xl p-6 mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-md bg-brand flex items-center justify-center text-2xl font-bold text-brand-contrast uppercase shrink-0">
          {user.email?.[0] ?? '?'}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-ink truncate">{user.email}</p>
          <p className="text-sm text-muted mt-0.5">Collector since {joinedYear}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Binders', value: (binders ?? []).length },
          { label: 'Cards', value: totalCards },
          { label: 'Collection value', value: `$${totalUsd.toFixed(2)}` },
        ].map(stat => (
          <div key={stat.label} className="bg-surface border border-line rounded-xl p-4 text-center">
            <p className="font-mono text-xl text-ink">{stat.value}</p>
            <p className="microlabel text-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Public binders */}
      <div className="bg-surface border border-line rounded-xl p-6">
        <h2 className="microlabel text-muted mb-4">
          Public binders
          <span className="ml-2 text-muted">({publicBinders.length})</span>
        </h2>

        {publicBinders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted">No public binders yet.</p>
            <p className="text-xs text-muted mt-1">
              Make a binder public from your{' '}
              <Link href="/dashboard" className="text-brand hover:underline">Dashboard</Link>.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {publicBinders.map(b => (
              <li key={b.id}>
                <Link
                  href={`/binders/${b.id}`}
                  className="flex items-center justify-between px-2 py-3 hover:bg-background transition-colors group"
                >
                  <span className="font-medium text-ink group-hover:text-brand transition-colors">
                    {b.name}
                  </span>
                  <span className="font-mono text-sm text-ink">
                    ${(binderValueMap.get(b.id) ?? 0).toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <LogoutButton />
      </div>
    </main>
  )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
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

  const publicBinders = (binders ?? []).filter(b => b.is_public)
  const totalCards = (holdings ?? []).reduce((sum, h) => sum + h.quantity, 0)
  const joinedYear = new Date(user.created_at).getFullYear()

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      {/* Profile card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-2xl font-bold text-violet-700 dark:text-violet-300 uppercase shrink-0">
          {user.email?.[0] ?? '?'}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{user.email}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Collector since {joinedYear}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Binders', value: (binders ?? []).length },
          { label: 'Cards', value: totalCards },
          { label: 'Collection value', value: `$${totalUsd.toFixed(2)}` },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Public binders */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Public Binders
          <span className="ml-2 text-xs font-normal text-slate-400">({publicBinders.length})</span>
        </h2>

        {publicBinders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500 dark:text-slate-400">No public binders yet.</p>
            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
              Make a binder public from your{' '}
              <Link href="/dashboard" className="text-violet-600 dark:text-violet-400 hover:underline">Dashboard</Link>.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {publicBinders.map(b => (
              <li key={b.id}>
                <Link
                  href={`/binders/${b.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {b.name}
                  </span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
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

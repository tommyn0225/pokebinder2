import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'
import BinderList from './BinderList'
import type { Binder } from '@/types/binder'
import type { Holding } from '@/types/holding'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: binders }, { data: holdings }] = await Promise.all([
    supabase
      .from('binders')
      .select('id, name, created_at')
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

  const bindersWithValue = ((binders ?? []) as Binder[]).map(b => ({
    ...b,
    total_usd: Math.round((binderValueMap.get(b.id) ?? 0) * 100) / 100,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">PokéBinder</h1>
        <div className="flex items-center gap-4">
          <Link href="/search" className="text-sm text-indigo-600 hover:underline">
            Search Cards
          </Link>
          <span className="text-sm text-gray-500">{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-700">Your Binders</h2>
          <p className="text-sm text-gray-500">
            Total collection value:{' '}
            <span className="font-semibold text-gray-800">${totalUsd.toFixed(2)}</span>
          </p>
        </div>
        <BinderList initial={bindersWithValue} />
      </main>
    </div>
  )
}

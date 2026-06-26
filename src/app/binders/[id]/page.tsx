import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import HoldingsList from './HoldingsList'
import BinderValueChart from './BinderValueChart'
import type { Holding } from '@/types/holding'

export default async function BinderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: binder } = await supabase
    .from('binders')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!binder) notFound()

  const { data: holdings } = await supabase
    .from('holdings')
    .select('id, binder_id, user_id, card_id, game, quantity, card_data, created_at')
    .eq('binder_id', id)
    .order('created_at', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">
          &larr; Dashboard
        </Link>
        <h1 className="text-xl font-bold">{binder.name}</h1>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-6 items-start">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <HoldingsList binderId={id} initial={(holdings ?? []) as Holding[]} />
          </div>

          {/* Sidebar chart */}
          <aside className="w-72 shrink-0">
            <div className="bg-white border rounded-lg px-4 py-4 sticky top-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Value Over Time
              </h2>
              <BinderValueChart binderId={id} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

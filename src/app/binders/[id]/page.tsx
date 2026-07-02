import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import HoldingsList from './HoldingsList'
import BinderValueChart from './BinderValueChart'
import type { Holding } from '@/types/holding'

export default async function BinderPage({ params }: { params: Promise<{ id: string }> }) {
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
    <main className="max-w-6xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/dashboard" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
          Dashboard
        </Link>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <span className="font-semibold text-slate-900 dark:text-slate-100">{binder.name}</span>
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          <HoldingsList binderId={id} initial={(holdings ?? []) as Holding[]} />
        </div>
        <aside className="w-72 shrink-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-4 sticky top-20">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Value Over Time
            </h2>
            <BinderValueChart binderId={id} />
          </div>
        </aside>
      </div>
    </main>
  )
}

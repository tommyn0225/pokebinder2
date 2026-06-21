import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import HoldingsList from './HoldingsList'
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
      <main className="max-w-4xl mx-auto px-6 py-10">
        <HoldingsList binderId={id} initial={(holdings ?? []) as Holding[]} />
      </main>
    </div>
  )
}

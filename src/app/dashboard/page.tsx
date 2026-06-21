import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'
import BinderList from './BinderList'
import type { Binder } from '@/types/binder'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: binders } = await supabase
    .from('binders')
    .select('id, name, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

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
        <h2 className="text-lg font-semibold text-gray-700 mb-6">Your Binders</h2>
        <BinderList initial={(binders ?? []) as Binder[]} />
      </main>
    </div>
  )
}

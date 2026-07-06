import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const features = [
  {
    index: '01',
    title: 'Three games, one place',
    description:
      'Search and collect cards from Magic: The Gathering, Pokémon, and One Piece — all in the same binder.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="12" height="16" rx="2" />
        <path d="M17 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" />
      </svg>
    ),
  },
  {
    index: '02',
    title: 'Organized in binders',
    description:
      'Create binders for decks, sets, or trades. Add cards with quantities and keep everything sorted your way.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    ),
  },
  {
    index: '03',
    title: 'Value over time',
    description:
      'See what your collection is worth today with live market prices, and watch its value trend over time.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="m7 14 4-4 3 3 5-6" />
      </svg>
    ),
  },
]

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <main className="max-w-5xl mx-auto px-6">
      {/* Hero */}
      <section className="flex flex-col items-center text-center pt-24 pb-16 sm:pt-32">
        <span className="microlabel rounded-md border border-line bg-surface px-3 py-1.5 text-muted">
          TCG collection tracker
        </span>
        <h1 className="mt-8 text-5xl sm:text-6xl font-bold tracking-tight text-ink">
          Binder<span className="text-brand">.</span>
        </h1>
        <p className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          Track your card collection&apos;s real value
        </p>
        <p className="mt-4 max-w-xl text-base sm:text-lg text-muted">
          Organize binders across Magic: The Gathering, Pokémon, and One Piece,
          with live market prices and value history — free.
        </p>
        <div className="mt-10 flex items-center gap-4">
          <Link
            href="/signup"
            className="control-label rounded-md bg-brand px-6 py-3 text-brand-contrast hover:bg-brand-hover transition-colors"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="control-label rounded-md border border-line bg-surface px-6 py-3 text-ink hover:border-ink transition-colors"
          >
            Log in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-4 pb-24 sm:grid-cols-3">
        {features.map(f => (
          <div
            key={f.title}
            className="rounded-xl border border-line bg-surface p-6"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-md border border-line flex items-center justify-center text-brand">
                {f.icon}
              </div>
              <span className="microlabel text-muted">{f.index}</span>
            </div>
            <h2 className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink">
              {f.title}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {f.description}
            </p>
          </div>
        ))}
      </section>
    </main>
  )
}

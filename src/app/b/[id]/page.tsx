import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import type { Card } from '@/types/card'
import type { Holding } from '@/types/holding'

// Public state depends on the binder's live is_public flag, so never cache.
export const dynamic = 'force-dynamic'

const GAME_LABELS: Record<string, string> = {
  mtg: 'MTG',
  pokemon: 'Pokémon',
  onepiece: 'One Piece',
}

function priceDisplay(card: Card): string {
  if (card.price.usd != null) return `$${card.price.usd.toFixed(2)}`
  if (card.price.eur != null) return `€${card.price.eur.toFixed(2)}`
  return '—'
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="max-w-md mx-auto px-6 py-20 text-center">
      <div className="rounded-xl border border-line bg-surface px-6 py-12">
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        <p className="text-sm text-muted mt-2">{body}</p>
        <Link
          href="/"
          className="control-label mt-6 inline-block rounded-md bg-brand hover:bg-brand-hover text-brand-contrast px-5 py-2.5 transition-colors"
        >
          Go to Binder
        </Link>
      </div>
    </main>
  )
}

type PublicHolding = Pick<Holding, 'id' | 'quantity' | 'for_trade' | 'card_data'>

export default async function PublicBinderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Service-role read: binders/holdings are owner-only under RLS, so a public
  // view must read past RLS and gate on is_public itself.
  const supabase = createServiceClient()
  const { data: binder } = await supabase
    .from('binders')
    .select('id, name, game, is_public')
    .eq('id', id)
    .maybeSingle()

  if (!binder) {
    return <Message title="Binder not found" body="This link doesn’t point to a binder that exists." />
  }
  if (!binder.is_public) {
    return <Message title="This binder is private" body="Its owner hasn’t made it public, so it can’t be viewed with this link." />
  }

  const { data: holdings } = await supabase
    .from('holdings')
    .select('id, quantity, for_trade, card_data')
    .eq('binder_id', id)
    .order('created_at', { ascending: true })

  const list = (holdings ?? []) as PublicHolding[]
  let totalUsd = 0
  let totalCards = 0
  for (const h of list) {
    totalUsd += (h.card_data.price.usd ?? 0) * h.quantity
    totalCards += h.quantity
  }
  const tradeCount = list.filter(h => h.for_trade).reduce((n, h) => n + h.quantity, 0)

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{binder.name}</h1>
          <span className="microlabel shrink-0 rounded border border-line bg-background text-muted px-2 py-0.5">
            {GAME_LABELS[binder.game] ?? binder.game}
          </span>
        </div>
        <p className="text-sm text-muted mt-0.5">Shared collection</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface">
        <div className="px-5 py-4">
          <p className="microlabel text-muted">Total value</p>
          <p className="mt-1 font-mono text-2xl text-ink">${totalUsd.toFixed(2)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="microlabel text-muted">Cards</p>
          <p className="mt-1 font-mono text-2xl text-ink">{totalCards.toLocaleString()}</p>
        </div>
        <div className="px-5 py-4">
          <p className="microlabel text-muted">For trade</p>
          <p className="mt-1 font-mono text-2xl text-ink">{tradeCount.toLocaleString()}</p>
        </div>
      </div>

      {/* Cards */}
      {list.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface text-center py-16">
          <p className="font-semibold text-ink">This binder is empty</p>
          <p className="text-sm text-muted mt-1">There are no cards to show yet.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {list.map(h => (
            <li key={h.id} className="bg-surface rounded-xl border border-line overflow-hidden flex flex-col">
              <div className="relative">
                {h.card_data.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.card_data.image_url} alt={h.card_data.name} loading="lazy" width={250} height={350} className="w-full h-auto object-cover" />
                ) : (
                  <div className="aspect-[2.5/3.5] bg-background flex items-center justify-center text-xs text-muted">
                    No image
                  </div>
                )}
                {h.quantity > 1 && (
                  <span className="absolute top-1 right-1 microlabel rounded bg-black/70 text-white px-1.5 py-0.5">
                    ×{h.quantity}
                  </span>
                )}
                {h.for_trade && (
                  <span className="absolute top-1 left-1 microlabel rounded bg-blue-600 text-white px-1.5 py-0.5">
                    For trade
                  </span>
                )}
              </div>
              <div className="p-2 flex flex-col gap-1 flex-1">
                <p className="text-xs font-semibold leading-tight line-clamp-2 text-ink">{h.card_data.name}</p>
                <p className="text-xs text-muted truncate">{h.card_data.set_name}</p>
                <div className="mt-auto pt-1">
                  <span className="text-sm font-semibold text-ink">{priceDisplay(h.card_data)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

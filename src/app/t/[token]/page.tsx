import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { finishPrice } from '@/lib/holdingValue'
import { logError } from '@/lib/logError'
import CardImage from '@/components/CardImage'
import type { Holding } from '@/types/holding'

// Visibility can be flipped at any time, so never cache.
export const dynamic = 'force-dynamic'

function priceDisplay(h: Pick<Holding, 'finish' | 'card_data'>): string {
  const usd = finishPrice(h.finish, h.card_data.price)
  if (usd != null) return `$${usd.toFixed(2)}`
  if (h.card_data.price.eur != null) return `€${h.card_data.price.eur.toFixed(2)}`
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

type PublicTradeHolding = Pick<Holding, 'id' | 'quantity' | 'finish' | 'card_data'>

export default async function PublicTradeListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Service-role read: holdings/trade_lists are owner-only under RLS, so a
  // public view must read past RLS and gate on is_public itself.
  const supabase = createServiceClient()
  const { data: tradeList, error: tradeListError } = await supabase
    .from('trade_lists')
    .select('user_id, is_public')
    .eq('token', token)
    .maybeSingle()

  if (tradeListError) {
    logError('t:page', tradeListError)
    return <Message title="Something went wrong" body="We couldn’t load this trade list right now. Please try again shortly." />
  }
  if (!tradeList) {
    return <Message title="Trade list not found" body="This link doesn’t point to a trade list that exists." />
  }
  if (!tradeList.is_public) {
    return <Message title="This trade list is private" body="Its owner hasn’t made it public, so it can’t be viewed with this link." />
  }

  const { data: holdings, error: holdingsError } = await supabase
    .from('holdings')
    .select('id, quantity, finish, card_data')
    .eq('user_id', tradeList.user_id)
    .eq('for_trade', true)
    .order('created_at', { ascending: true })

  if (holdingsError) {
    logError('t:page:holdings', holdingsError)
    return <Message title="Something went wrong" body="We couldn’t load this trade list right now. Please try again shortly." />
  }

  const list = (holdings ?? []) as PublicTradeHolding[]
  const totalCards = list.reduce((n, h) => n + h.quantity, 0)

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Cards for trade</h1>
        <p className="text-sm text-muted mt-0.5">
          {totalCards === 0
            ? 'This collector has no cards up for trade right now.'
            : `${totalCards.toLocaleString()} card${totalCards === 1 ? '' : 's'} up for trade.`}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface text-center py-16">
          <p className="font-semibold text-ink">Nothing up for trade</p>
          <p className="text-sm text-muted mt-1">Check back later.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {list.map(h => (
            <li key={h.id} className="bg-surface rounded-xl border border-line overflow-hidden flex flex-col">
              <div className="relative">
                <CardImage
                  src={h.card_data.image_url}
                  alt={h.card_data.name}
                  width={250}
                  height={350}
                  className="w-full h-auto object-cover"
                  fallback={
                    <div className="aspect-[2.5/3.5] bg-background flex items-center justify-center text-xs text-muted">
                      No image
                    </div>
                  }
                />
                {h.quantity > 1 && (
                  <span className="absolute top-1 right-1 microlabel rounded bg-black/70 text-white px-1.5 py-0.5">
                    ×{h.quantity}
                  </span>
                )}
              </div>
              <div className="p-2 flex flex-col gap-1 flex-1">
                <p className="text-xs font-semibold leading-tight line-clamp-2 text-ink">{h.card_data.name}</p>
                <p className="text-xs text-muted truncate">{h.card_data.set_name}</p>
                <div className="mt-auto pt-1 flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-ink">{priceDisplay(h)}</span>
                  {h.finish === 'foil' && (
                    <span className="microlabel rounded border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 px-1 py-0.5">
                      Foil
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

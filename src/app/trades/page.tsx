import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TradeShareControl from './TradeShareControl'
import DataErrorPanel from '@/components/DataErrorPanel'
import CardImage from '@/components/CardImage'
import { logError } from '@/lib/logError'
import { finishPrice } from '@/lib/holdingValue'
import type { Card } from '@/types/card'
import type { Finish } from '@/types/holding'

function priceDisplay(h: { finish: Finish; card_data: Card }): string {
  const usd = finishPrice(h.finish, h.card_data.price)
  if (usd != null) return `$${usd.toFixed(2)}`
  if (h.card_data.price.eur != null) return `€${h.card_data.price.eur.toFixed(2)}`
  return '—'
}

interface TradeHolding {
  id: string
  quantity: number
  finish: Finish
  binder_id: string
  card_data: Card
  binders: { name: string; game: string } | null
}

export default async function TradesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Ensure a trade-list row exists (for the share token) without resetting
  // an existing visibility choice.
  await supabase.from('trade_lists').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })

  const [{ data, error: holdingsError }, { data: tradeList }] = await Promise.all([
    supabase
      .from('holdings')
      .select('id, quantity, finish, binder_id, card_data, binders(name, game)')
      .eq('user_id', user.id)
      .eq('for_trade', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('trade_lists')
      .select('token')
      .eq('user_id', user.id)
      .single(),
  ])

  if (holdingsError) {
    logError('trades:page', holdingsError)
    return (
      <main className="max-w-6xl mx-auto px-6 py-8">
        <DataErrorPanel />
      </main>
    )
  }

  const list = (data ?? []) as unknown as TradeHolding[]
  const totalCards = list.reduce((n, h) => n + h.quantity, 0)

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/dashboard" className="text-muted hover:text-ink transition-colors">
          Dashboard
        </Link>
        <span className="text-muted">/</span>
        <span className="font-semibold text-ink">For trade</span>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Cards for trade</h1>
          <p className="text-sm text-muted mt-0.5">
            {totalCards === 0
              ? 'Cards you mark “For trade” in a binder show up here.'
              : `${totalCards.toLocaleString()} card${totalCards === 1 ? '' : 's'} across your binders.`}
          </p>
        </div>
        {tradeList && (
          <TradeShareControl token={tradeList.token} />
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface text-center py-16">
          <p className="font-semibold text-ink">Nothing up for trade</p>
          <p className="text-sm text-muted mt-1">
            Open a binder and mark cards “For trade” to list them here.
          </p>
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
                <div className="mt-auto pt-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-semibold text-ink">{priceDisplay(h)}</span>
                    {h.finish === 'foil' && (
                      <span className="microlabel rounded border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 px-1 py-0.5">
                        Foil
                      </span>
                    )}
                  </div>
                  {h.binders && (
                    <Link
                      href={`/binders/${h.binder_id}`}
                      className="microlabel shrink-0 rounded border border-line bg-background text-muted px-1.5 py-0.5 hover:text-ink hover:border-ink transition-colors truncate max-w-[7rem]"
                      title={h.binders.name}
                    >
                      {h.binders.name}
                    </Link>
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

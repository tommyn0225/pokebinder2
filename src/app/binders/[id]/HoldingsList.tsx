'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Finish, Holding } from '@/types/holding'
import type { Card, CardSearchResult } from '@/types/card'
import type { Binder } from '@/types/binder'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { finishPrice, holdingUnitPrice } from '@/lib/holdingValue'
import { useToast } from '@/components/Toast'

type GameKey = Binder['game']
type ViewMode = 'list' | 'grid'

const PLACEHOLDERS: Record<GameKey, string> = {
  mtg: 'Search MTG cards…',
  pokemon: 'Search Pokémon cards…',
  onepiece: 'Search One Piece cards…',
}

function priceDisplay(card: Card): string {
  if (card.price.usd != null) return `$${card.price.usd.toFixed(2)}`
  if (card.price.eur != null) return `€${card.price.eur.toFixed(2)}`
  return '—'
}

// A holding's displayed price honors its finish (foil values against usd_foil).
function holdingPriceDisplay(h: Holding): string {
  const usd = finishPrice(h.finish, h.card_data.price)
  if (usd != null) return `$${usd.toFixed(2)}`
  if (h.card_data.price.eur != null) return `€${h.card_data.price.eur.toFixed(2)}`
  return '—'
}

function FoilTag() {
  return (
    <span className="microlabel rounded border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 px-1 py-0.5">
      Foil
    </span>
  )
}

function QtyStepper({ quantity, name, onChange }: { quantity: number; name: string; onChange: (q: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(quantity - 1)}
        disabled={quantity <= 1}
        aria-label={`Decrease quantity of ${name}`}
        className="w-6 h-6 rounded border border-line text-muted hover:text-ink hover:border-ink disabled:opacity-30 text-xs transition-colors"
      >
        −
      </button>
      <span className="w-7 text-center text-ink">{quantity}</span>
      <button
        onClick={() => onChange(quantity + 1)}
        aria-label={`Increase quantity of ${name}`}
        className="w-6 h-6 rounded border border-line text-muted hover:text-ink hover:border-ink text-xs transition-colors"
      >
        +
      </button>
    </div>
  )
}

function TradeToggle({ on, name, onClick }: { on: boolean; name: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={`Mark ${name} ${on ? 'not for trade' : 'for trade'}`}
      className={`microlabel rounded border px-2 py-0.5 transition-colors ${
        on
          ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
          : 'border-line text-muted hover:text-ink hover:border-ink'
      }`}
    >
      {on ? '✓ For trade' : 'For trade'}
    </button>
  )
}

export default function HoldingsList({ binderId, binderGame, initial }: { binderId: string; binderGame: GameKey; initial: Holding[] }) {
  const [holdings, setHoldings] = useState<Holding[]>(initial)
  const [query,     setQuery]   = useState('')
  const [results,   setResults] = useState<Card[]>([])
  const [searching, setSearching] = useState(false)
  const [adding,    setAdding]  = useState<string | null>(null)
  const [addOpen,   setAddOpen] = useState(true)
  const [view,      setView]    = useState<ViewMode>('list')
  // Per-result foil choice, keyed by card id; absent means nonfoil.
  const [foilSel,   setFoilSel] = useState<Record<string, boolean>>({})
  const toast = useToast()

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}&game=${binderGame}`)
      const data: CardSearchResult = await res.json()
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Search failed')
      setResults(data.cards)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Search failed', 'error')
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [toast, binderGame])

  // Live search: fire once typing settles
  const debouncedQuery = useDebouncedValue(query)
  useEffect(() => {
    search(debouncedQuery)
  }, [debouncedQuery, search])

  async function handleAdd(card: Card) {
    const finish: Finish = foilSel[card.id] ? 'foil' : 'nonfoil'
    setAdding(card.id)
    const res = await fetch(`/api/binders/${binderId}/holdings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.id, game: card.game, quantity: 1, finish, card_data: card }),
    })
    const json = await res.json()
    if (!res.ok) toast(json.error ?? 'Failed to add card', 'error')
    else {
      // A different finish of the same card is its own stack, so match on both.
      setHoldings(prev => {
        const idx = prev.findIndex(h => h.card_id === card.id && h.finish === finish)
        if (idx >= 0) { const next = [...prev]; next[idx] = json; return next }
        return [...prev, json]
      })
      toast(`Added ${card.name}${finish === 'foil' ? ' (foil)' : ''}`, 'success')
    }
    setAdding(null)
  }

  async function handleQuantityChange(holdingId: string, quantity: number) {
    if (quantity < 1) return
    const res = await fetch(`/api/binders/${binderId}/holdings/${holdingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    })
    const json = await res.json()
    if (!res.ok) toast(json.error ?? 'Failed to update quantity', 'error')
    else setHoldings(prev => prev.map(h => h.id === holdingId ? json : h))
  }

  async function handleToggleTrade(holdingId: string, current: boolean) {
    const res = await fetch(`/api/binders/${binderId}/holdings/${holdingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ for_trade: !current }),
    })
    const json = await res.json()
    if (!res.ok) toast(json.error ?? 'Failed to update trade status', 'error')
    else setHoldings(prev => prev.map(h => h.id === holdingId ? json : h))
  }

  async function handleRemove(holdingId: string) {
    const res = await fetch(`/api/binders/${binderId}/holdings/${holdingId}`, { method: 'DELETE' })
    if (!res.ok) toast('Failed to remove card', 'error')
    else setHoldings(prev => prev.filter(h => h.id !== holdingId))
  }

  const totalValue = holdings.reduce((sum, h) => sum + holdingUnitPrice(h) * h.quantity, 0)
  const placeholder = PLACEHOLDERS[binderGame] ?? 'Search cards…'

  return (
    <div className="space-y-6">
      {/* Search & add */}
      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="microlabel text-muted">Add cards</h2>
          <button
            type="button"
            onClick={() => setAddOpen(o => !o)}
            aria-expanded={addOpen}
            className="microlabel flex items-center gap-1 text-muted hover:text-ink transition-colors"
          >
            {addOpen ? 'Minimize' : 'Expand'}
            <span className="text-[9px]">{addOpen ? '▲' : '▼'}</span>
          </button>
        </div>

        {addOpen && (
          <div className="mt-3">
            <form onSubmit={e => { e.preventDefault(); search(query) }} className="flex gap-2 mb-3">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand"
              />
              <button
                type="submit"
                disabled={searching || query.trim().length < 2}
                className="control-label rounded-md bg-brand hover:bg-brand-hover text-brand-contrast px-4 py-2.5 disabled:opacity-50 transition-colors"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </form>

            {results.length > 0 && (
              <ul className="rounded-md border border-line divide-y divide-line bg-surface max-h-72 overflow-y-auto">
                {results.map(card => {
                  const finish: Finish = foilSel[card.id] ? 'foil' : 'nonfoil'
                  // Show the foil price when we have one, otherwise fall back to
                  // the card's normal price display (foil still marks the copy).
                  const priceStr =
                    finish === 'foil' && card.price.usd_foil != null
                      ? `$${card.price.usd_foil.toFixed(2)}`
                      : priceDisplay(card)
                  return (
                  <li key={card.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-background transition-colors">
                    {card.image_url && (
                      <img src={card.image_url} alt={card.name} loading="lazy" width={32} height={44} className="w-8 h-11 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{card.name}</p>
                      <p className="text-xs text-muted">{card.set_name} · {priceStr}</p>
                    </div>
                    {/* Finish selector — always shown, defaults to Normal */}
                    <div
                      role="group"
                      aria-label={`Finish for ${card.name}`}
                      className="flex shrink-0 divide-x divide-line rounded-md border border-line overflow-hidden"
                    >
                      {(['nonfoil', 'foil'] as Finish[]).map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFoilSel(s => ({ ...s, [card.id]: f === 'foil' }))}
                          aria-pressed={finish === f}
                          className={`microlabel px-2.5 py-1.5 transition-colors ${
                            finish === f ? 'bg-brand text-brand-contrast' : 'bg-surface text-muted hover:text-ink'
                          }`}
                        >
                          {f === 'foil' ? 'Foil' : 'Normal'}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleAdd(card)}
                      disabled={adding === card.id}
                      className="microlabel shrink-0 rounded-md border border-line px-3 py-1.5 text-ink hover:border-brand hover:text-brand disabled:opacity-50 transition-colors"
                    >
                      {adding === card.id ? 'Adding…' : '+ Add'}
                    </button>
                  </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Holdings */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line gap-3">
          <h2 className="microlabel text-muted">Cards in this binder</h2>
          <div className="flex items-center gap-4">
            {/* View toggle */}
            <div className="flex divide-x divide-line rounded-md border border-line overflow-hidden">
              {(['list', 'grid'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`microlabel px-3 py-1 transition-colors ${
                    view === v ? 'bg-brand text-brand-contrast' : 'bg-surface text-muted hover:text-ink'
                  }`}
                >
                  {v === 'list' ? 'List' : 'Grid'}
                </button>
              ))}
            </div>
            <span className="text-sm font-semibold text-ink">${totalValue.toFixed(2)}</span>
          </div>
        </div>

        {holdings.length === 0 ? (
          <p className="text-center text-muted py-12 text-sm">
            No cards yet — search above to add some.
          </p>
        ) : view === 'grid' ? (
          /* Grid view */
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-5">
            {holdings.map(h => (
              <li key={h.id} className="bg-surface rounded-xl border border-line overflow-hidden flex flex-col">
                <div className="relative">
                  {h.card_data.image_url ? (
                    <img src={h.card_data.image_url} alt={h.card_data.name} loading="lazy" width={250} height={350} className="w-full h-auto object-cover" />
                  ) : (
                    <div className="aspect-[2.5/3.5] bg-background flex items-center justify-center text-xs text-muted">
                      No image
                    </div>
                  )}
                  {h.for_trade && (
                    <span className="absolute top-1 left-1 microlabel rounded bg-blue-600 text-white px-1.5 py-0.5">
                      For trade
                    </span>
                  )}
                </div>
                <div className="p-2 flex flex-col gap-1.5 flex-1">
                  <p className="text-xs font-semibold leading-tight line-clamp-2 text-ink">{h.card_data.name}</p>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-xs text-muted truncate">{h.card_data.set_name}</p>
                    {h.finish === 'foil' && <FoilTag />}
                  </div>
                  <div className="mt-auto pt-1 flex items-center justify-between">
                    <span className="font-mono text-sm text-ink">{holdingPriceDisplay(h)}</span>
                    <QtyStepper quantity={h.quantity} name={h.card_data.name} onChange={q => handleQuantityChange(h.id, q)} />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <TradeToggle on={h.for_trade} name={h.card_data.name} onClick={() => handleToggleTrade(h.id, h.for_trade)} />
                    <button
                      onClick={() => handleRemove(h.id)}
                      className="text-xs text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          /* List view (default) */
          <>
          {/* Mobile: card layout */}
          <ul className="sm:hidden divide-y divide-line">
            {holdings.map(h => (
              <li key={h.id} className="p-4 flex gap-3">
                {h.card_data.image_url && (
                  <img src={h.card_data.image_url} alt={h.card_data.name} loading="lazy" width={48} height={66} className="w-12 h-16 object-cover rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="font-medium text-ink truncate">{h.card_data.name}</p>
                    {h.finish === 'foil' && <FoilTag />}
                  </div>
                  <p className="text-xs text-muted truncate mt-0.5">{h.card_data.set_name}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-sm text-ink">{holdingPriceDisplay(h)}</span>
                    <QtyStepper quantity={h.quantity} name={h.card_data.name} onChange={q => handleQuantityChange(h.id, q)} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <TradeToggle on={h.for_trade} name={h.card_data.name} onClick={() => handleToggleTrade(h.id, h.for_trade)} />
                    <button
                      onClick={() => handleRemove(h.id)}
                      className="text-xs text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table layout */}
          <table className="hidden sm:table w-full text-sm">
            <thead className="bg-background">
              <tr>
                <th className="microlabel px-5 py-3 text-left font-normal text-muted">Card</th>
                <th className="microlabel px-5 py-3 text-left font-normal text-muted">Set</th>
                <th className="microlabel px-5 py-3 text-right font-normal text-muted">Price</th>
                <th className="microlabel px-5 py-3 text-center font-normal text-muted">Qty</th>
                <th className="microlabel px-5 py-3 text-center font-normal text-muted">Trade</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {holdings.map(h => (
                <tr key={h.id} className="hover:bg-background transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {h.card_data.image_url && (
                        <img src={h.card_data.image_url} alt={h.card_data.name} loading="lazy" width={32} height={44} className="w-8 h-11 object-cover rounded" />
                      )}
                      <span className="font-medium text-ink">{h.card_data.name}</span>
                      {h.finish === 'foil' && <FoilTag />}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted">{h.card_data.set_name}</td>
                  <td className="px-5 py-3 text-right text-ink">{holdingPriceDisplay(h)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-center">
                      <QtyStepper quantity={h.quantity} name={h.card_data.name} onChange={q => handleQuantityChange(h.id, q)} />
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-center">
                      <TradeToggle on={h.for_trade} name={h.card_data.name} onClick={() => handleToggleTrade(h.id, h.for_trade)} />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleRemove(h.id)}
                      className="text-xs text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  )
}

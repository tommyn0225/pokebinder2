'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Holding } from '@/types/holding'
import type { Card, CardSearchResult } from '@/types/card'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { useToast } from '@/components/Toast'

type GameKey = Card['game']

const GAMES: { key: GameKey; label: string; placeholder: string }[] = [
  { key: 'mtg',      label: 'MTG',       placeholder: 'Search MTG cards…' },
  { key: 'pokemon',  label: 'Pokémon',   placeholder: 'Search Pokémon cards…' },
  { key: 'onepiece', label: 'One Piece', placeholder: 'Search One Piece cards…' },
]

function priceDisplay(card: Card): string {
  if (card.price.usd != null) return `$${card.price.usd.toFixed(2)}`
  if (card.price.eur != null) return `€${card.price.eur.toFixed(2)}`
  return '—'
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

export default function HoldingsList({ binderId, initial }: { binderId: string; initial: Holding[] }) {
  const [holdings, setHoldings] = useState<Holding[]>(initial)
  const [query,     setQuery]   = useState('')
  const [game,      setGame]    = useState<GameKey>('mtg')
  const [results,   setResults] = useState<Card[]>([])
  const [searching, setSearching] = useState(false)
  const [adding,    setAdding]  = useState<string | null>(null)
  const toast = useToast()

  const search = useCallback(async (q: string, g: GameKey) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}&game=${g}`)
      const data: CardSearchResult = await res.json()
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Search failed')
      setResults(data.cards)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Search failed', 'error')
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [toast])

  // Live search: fire once typing settles or the game changes
  const debouncedQuery = useDebouncedValue(query)
  useEffect(() => {
    search(debouncedQuery, game)
  }, [debouncedQuery, game, search])

  async function handleAdd(card: Card) {
    setAdding(card.id)
    const res = await fetch(`/api/binders/${binderId}/holdings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.id, game: card.game, quantity: 1, card_data: card }),
    })
    const json = await res.json()
    if (!res.ok) toast(json.error ?? 'Failed to add card', 'error')
    else {
      setHoldings(prev => {
        const idx = prev.findIndex(h => h.card_id === card.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = json; return next }
        return [...prev, json]
      })
      toast(`Added ${card.name}`, 'success')
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

  async function handleRemove(holdingId: string) {
    const res = await fetch(`/api/binders/${binderId}/holdings/${holdingId}`, { method: 'DELETE' })
    if (!res.ok) toast('Failed to remove card', 'error')
    else setHoldings(prev => prev.filter(h => h.id !== holdingId))
  }

  const totalValue = holdings.reduce((sum, h) => sum + (h.card_data.price.usd ?? 0) * h.quantity, 0)
  const placeholder = GAMES.find(g => g.key === game)?.placeholder ?? 'Search cards…'

  return (
    <div className="space-y-6">
      {/* Search & add */}
      <div className="rounded-xl border border-line bg-surface p-5">
        <h2 className="microlabel text-muted mb-3">Add cards</h2>

        {/* Game selector */}
        <div className="mb-3 flex w-fit divide-x divide-line rounded-md border border-line overflow-hidden">
          {GAMES.map(g => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGame(g.key)}
              aria-pressed={game === g.key}
              className={`microlabel px-3 py-1.5 transition-colors ${
                game === g.key
                  ? 'bg-brand text-brand-contrast'
                  : 'bg-surface text-muted hover:text-ink'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <form onSubmit={e => { e.preventDefault(); search(query, game) }} className="flex gap-2 mb-3">
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
            {results.map(card => (
              <li key={card.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-background transition-colors">
                {card.image_url && (
                  <img src={card.image_url} alt={card.name} loading="lazy" width={32} height={44} className="w-8 h-11 object-cover rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{card.name}</p>
                  <p className="text-xs text-muted">{card.set_name} · {priceDisplay(card)}</p>
                </div>
                <button
                  onClick={() => handleAdd(card)}
                  disabled={adding === card.id}
                  className="microlabel shrink-0 rounded-md border border-line px-3 py-1.5 text-ink hover:border-brand hover:text-brand disabled:opacity-50 transition-colors"
                >
                  {adding === card.id ? 'Adding…' : '+ Add'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Holdings table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="microlabel text-muted">Cards in this binder</h2>
          <span className="text-sm font-semibold text-ink">${totalValue.toFixed(2)}</span>
        </div>

        {holdings.length === 0 ? (
          <p className="text-center text-muted py-12 text-sm">
            No cards yet — search above to add some.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-background">
              <tr>
                <th className="microlabel px-5 py-3 text-left font-normal text-muted">Card</th>
                <th className="microlabel px-5 py-3 text-left font-normal text-muted">Set</th>
                <th className="microlabel px-5 py-3 text-right font-normal text-muted">Price</th>
                <th className="microlabel px-5 py-3 text-center font-normal text-muted">Qty</th>
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
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted">{h.card_data.set_name}</td>
                  <td className="px-5 py-3 text-right text-ink">{priceDisplay(h.card_data)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleQuantityChange(h.id, h.quantity - 1)}
                        disabled={h.quantity <= 1}
                        aria-label={`Decrease quantity of ${h.card_data.name}`}
                        className="w-6 h-6 rounded border border-line text-muted hover:text-ink hover:border-ink disabled:opacity-30 text-xs transition-colors"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-ink">{h.quantity}</span>
                      <button
                        onClick={() => handleQuantityChange(h.id, h.quantity + 1)}
                        aria-label={`Increase quantity of ${h.card_data.name}`}
                        className="w-6 h-6 rounded border border-line text-muted hover:text-ink hover:border-ink text-xs transition-colors"
                      >
                        +
                      </button>
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
        )}
      </div>
    </div>
  )
}

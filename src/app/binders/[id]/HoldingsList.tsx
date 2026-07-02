'use client'

import { useState, useCallback } from 'react'
import type { Holding } from '@/types/holding'
import type { Card, CardSearchResult } from '@/types/card'

function priceDisplay(card: Card): string {
  if (card.price.usd != null) return `$${card.price.usd.toFixed(2)}`
  if (card.price.eur != null) return `€${card.price.eur.toFixed(2)}`
  return '—'
}

export default function HoldingsList({ binderId, initial }: { binderId: string; initial: Holding[] }) {
  const [holdings, setHoldings] = useState<Holding[]>(initial)
  const [query,     setQuery]   = useState('')
  const [results,   setResults] = useState<Card[]>([])
  const [searching, setSearching] = useState(false)
  const [adding,    setAdding]  = useState<string | null>(null)
  const [error,     setError]   = useState<string | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}&game=mtg`)
      const data: CardSearchResult = await res.json()
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Search failed')
      setResults(data.cards)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  async function handleAdd(card: Card) {
    setAdding(card.id)
    setError(null)
    const res = await fetch(`/api/binders/${binderId}/holdings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.id, game: card.game, quantity: 1, card_data: card }),
    })
    const json = await res.json()
    if (!res.ok) setError(json.error ?? 'Failed to add card')
    else {
      setHoldings(prev => {
        const idx = prev.findIndex(h => h.card_id === card.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = json; return next }
        return [...prev, json]
      })
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
    if (!res.ok) setError(json.error ?? 'Failed to update quantity')
    else setHoldings(prev => prev.map(h => h.id === holdingId ? json : h))
  }

  async function handleRemove(holdingId: string) {
    setError(null)
    const res = await fetch(`/api/binders/${binderId}/holdings/${holdingId}`, { method: 'DELETE' })
    if (!res.ok) setError('Failed to remove card')
    else setHoldings(prev => prev.filter(h => h.id !== holdingId))
  }

  const totalValue = holdings.reduce((sum, h) => sum + (h.card_data.price.usd ?? 0) * h.quantity, 0)

  return (
    <div className="space-y-6">
      {/* Search & add */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Add Cards
        </h2>
        <form onSubmit={e => { e.preventDefault(); search(query) }} className="flex gap-2 mb-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search MTG cards…"
            className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            type="submit"
            disabled={searching || query.trim().length < 2}
            className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results.length > 0 && (
          <ul className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 max-h-72 overflow-y-auto">
            {results.map(card => (
              <li key={card.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                {card.image_url && (
                  <img src={card.image_url} alt={card.name} loading="lazy" className="w-8 h-11 object-cover rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{card.name}</p>
                  <p className="text-xs text-slate-400">{card.set_name} · {priceDisplay(card)}</p>
                </div>
                <button
                  onClick={() => handleAdd(card)}
                  disabled={adding === card.id}
                  className="text-xs bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 px-3 py-1 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900 disabled:opacity-50 transition-colors shrink-0"
                >
                  {adding === card.id ? 'Adding…' : '+ Add'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Holdings table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Cards in this binder
          </h2>
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            ${totalValue.toFixed(2)}
          </span>
        </div>

        {holdings.length === 0 ? (
          <p className="text-center text-slate-400 dark:text-slate-600 py-12 text-sm">
            No cards yet — search above to add some.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Card</th>
                <th className="px-5 py-3 text-left">Set</th>
                <th className="px-5 py-3 text-right">Price</th>
                <th className="px-5 py-3 text-center">Qty</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {holdings.map(h => (
                <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {h.card_data.image_url && (
                        <img src={h.card_data.image_url} alt={h.card_data.name} loading="lazy" className="w-8 h-11 object-cover rounded" />
                      )}
                      <span className="font-medium text-slate-900 dark:text-slate-100">{h.card_data.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{h.card_data.set_name}</td>
                  <td className="px-5 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    {priceDisplay(h.card_data)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleQuantityChange(h.id, h.quantity - 1)}
                        disabled={h.quantity <= 1}
                        className="w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-xs font-bold transition-colors"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-slate-900 dark:text-slate-100">{h.quantity}</span>
                      <button
                        onClick={() => handleQuantityChange(h.id, h.quantity + 1)}
                        className="w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleRemove(h.id)}
                      className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
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

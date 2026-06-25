'use client'

import { useState, useCallback } from 'react'
import type { Holding } from '@/types/holding'
import type { Card, CardSearchResult } from '@/types/card'

function priceDisplay(card: Card): string {
  if (card.price.usd != null) return `$${card.price.usd.toFixed(2)}`
  if (card.price.eur != null) return `€${card.price.eur.toFixed(2)}`
  return '—'
}

interface Props {
  binderId: string
  initial: Holding[]
}

export default function HoldingsList({ binderId, initial }: Props) {
  const [holdings, setHoldings] = useState<Holding[]>(initial)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Card[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    search(query)
  }

  async function handleAdd(card: Card) {
    setAdding(card.id)
    setError(null)
    const res = await fetch(`/api/binders/${binderId}/holdings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.id, game: card.game, quantity: 1, card_data: card }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to add card')
    } else {
      // If already existed (updated), replace; otherwise append
      setHoldings(prev => {
        const idx = prev.findIndex(h => h.card_id === card.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = json
          return next
        }
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
    if (!res.ok) {
      setError(json.error ?? 'Failed to update quantity')
    } else {
      setHoldings(prev => prev.map(h => (h.id === holdingId ? json : h)))
    }
  }

  async function handleRemove(holdingId: string) {
    setError(null)
    const res = await fetch(`/api/binders/${binderId}/holdings/${holdingId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Failed to remove card')
    } else {
      setHoldings(prev => prev.filter(h => h.id !== holdingId))
    }
  }

  return (
    <div className="space-y-8">
      {/* Search & add */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Add Cards
        </h2>
        <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search MTG cards…"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="submit"
            disabled={searching || query.trim().length < 2}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700 transition-colors"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results.length > 0 && (
          <ul className="border rounded-lg divide-y bg-white max-h-72 overflow-y-auto">
            {results.map(card => (
              <li key={card.id} className="flex items-center gap-3 px-4 py-2">
                {card.image_url && (
                  <img src={card.image_url} alt={card.name} className="w-8 h-11 object-cover rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{card.name}</p>
                  <p className="text-xs text-gray-400">{card.set_name} · {priceDisplay(card)}</p>
                </div>
                <button
                  onClick={() => handleAdd(card)}
                  disabled={adding === card.id}
                  className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                >
                  {adding === card.id ? 'Adding…' : '+ Add'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Holdings table */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Cards in this Binder
          </h2>
          <span className="text-sm text-gray-500">
            Est. value:{' '}
            <span className="font-semibold text-gray-800">
              ${holdings.reduce((sum, h) => sum + (h.card_data.price.usd ?? 0) * h.quantity, 0).toFixed(2)}
            </span>
          </span>
        </div>
        {holdings.length === 0 ? (
          <p className="text-center text-gray-400 py-12">
            No cards yet — search above to add some.
          </p>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Card</th>
                  <th className="px-4 py-3 text-left">Set</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {holdings.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {h.card_data.image_url && (
                          <img
                            src={h.card_data.image_url}
                            alt={h.card_data.name}
                            className="w-8 h-11 object-cover rounded"
                          />
                        )}
                        <span className="font-medium">{h.card_data.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{h.card_data.set_name}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                      {priceDisplay(h.card_data)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleQuantityChange(h.id, h.quantity - 1)}
                          disabled={h.quantity <= 1}
                          className="w-6 h-6 rounded border text-gray-500 hover:bg-gray-100 disabled:opacity-30 text-xs font-bold"
                        >
                          −
                        </button>
                        <span className="w-8 text-center">{h.quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(h.id, h.quantity + 1)}
                          className="w-6 h-6 rounded border text-gray-500 hover:bg-gray-100 text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemove(h.id)}
                        className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

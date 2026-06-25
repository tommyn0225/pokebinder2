'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { Card, CardSearchResult } from '@/types/card'

function PriceTag({ price }: { price: Card['price'] }) {
  const display = price.usd != null ? `$${price.usd.toFixed(2)}` : price.eur != null ? `€${price.eur.toFixed(2)}` : '—'
  return <span className="text-sm font-medium text-emerald-600">{display}</span>
}

function CardGrid({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
      {cards.map((card) => (
        <li key={card.id} className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
          {card.image_url ? (
            <img src={card.image_url} alt={card.name} className="w-full object-cover" />
          ) : (
            <div className="aspect-[2.5/3.5] bg-gray-100 flex items-center justify-center text-xs text-gray-400">
              No image
            </div>
          )}
          <div className="p-2 flex flex-col gap-0.5 flex-1">
            <p className="text-xs font-semibold leading-tight line-clamp-2">{card.name}</p>
            <p className="text-xs text-gray-400">{card.set_name}</p>
            {card.type_line && <p className="text-xs text-gray-400 truncate">{card.type_line}</p>}
            <div className="mt-auto pt-1">
              <PriceTag price={card.price} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

type Game = 'mtg' | 'pokemon' | 'onepiece'

const GAMES: { value: Game; label: string; placeholder: string }[] = [
  { value: 'mtg', label: 'MTG', placeholder: 'Search Magic: The Gathering cards…' },
  { value: 'pokemon', label: 'Pokémon', placeholder: 'Search Pokémon cards…' },
  { value: 'onepiece', label: 'One Piece', placeholder: 'Search One Piece cards…' },
]

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [game, setGame] = useState<Game>('mtg')
  const [result, setResult] = useState<CardSearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string, g: Game) => {
    if (q.trim().length < 2) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}&game=${g}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Search failed.')
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    search(query, game)
  }

  const placeholder = GAMES.find((g) => g.value === game)?.placeholder ?? 'Search cards…'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">
          &larr; Dashboard
        </Link>
        <h1 className="text-xl font-bold">Search Cards</h1>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-3">
          {GAMES.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => { setGame(g.value); setResult(null); setError(null) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                game === g.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border text-gray-600 hover:border-indigo-400 hover:text-indigo-600'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="submit"
            disabled={loading || query.trim().length < 2}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700 transition-colors"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

        {result && (
          <p className="mt-4 text-sm text-gray-500">
            {result.total.toLocaleString()} result{result.total !== 1 ? 's' : ''}
            {result.has_more ? ' (showing first page)' : ''}
          </p>
        )}

        {result && <CardGrid cards={result.cards} />}

        {result && result.cards.length === 0 && !error && (
          <p className="mt-8 text-center text-gray-400">No cards found for &ldquo;{query}&rdquo;.</p>
        )}
      </main>
    </div>
  )
}

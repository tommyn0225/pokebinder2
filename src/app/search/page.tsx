'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Card, CardSearchResult } from '@/types/card'
import type { SetInfo } from '@/app/api/cards/sets/route'

// ── Types ────────────────────────────────────────────────────────────────────

type Game = 'mtg' | 'pokemon' | 'onepiece'
type SortKey = 'name' | 'price_asc' | 'price_desc'

interface Filters {
  set: string
  colors: string[]
  type: string
  rarity: string
  priceMin: string
  priceMax: string
}

const EMPTY_FILTERS: Filters = {
  set: '',
  colors: [],
  type: '',
  rarity: '',
  priceMin: '',
  priceMax: '',
}

const PAGE_SIZE = 30
const PRICE_MAX_SLIDER = 500

// ── Per-game filter config ───────────────────────────────────────────────────

const MTG_COLORS = [
  { code: 'W', label: 'White',     bg: 'bg-yellow-50 border-yellow-300 text-yellow-800' },
  { code: 'U', label: 'Blue',      bg: 'bg-blue-100 border-blue-400 text-blue-800' },
  { code: 'B', label: 'Black',     bg: 'bg-gray-800 border-gray-600 text-white' },
  { code: 'R', label: 'Red',       bg: 'bg-red-100 border-red-400 text-red-800' },
  { code: 'G', label: 'Green',     bg: 'bg-green-100 border-green-500 text-green-800' },
  { code: 'C', label: 'Colorless', bg: 'bg-gray-100 border-gray-400 text-gray-700' },
]

const MTG_TYPES     = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Battle']
const MTG_RARITIES  = [
  { value: 'common',   label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare',     label: 'Rare' },
  { value: 'mythic',   label: 'Mythic' },
  { value: 'special',  label: 'Special' },
]

const POKEMON_TYPES    = ['Pokémon', 'Trainer', 'Energy']
const POKEMON_RARITIES = ['Common', 'Uncommon', 'Rare', 'Rare Holo', 'Rare Ultra', 'Rare Secret']

const OP_COLORS   = ['Red', 'Blue', 'Green', 'Purple', 'Black', 'Yellow']
const OP_TYPES    = ['Leader', 'Character', 'Event', 'Stage']
const OP_RARITIES = ['C', 'UC', 'R', 'SR', 'SEC', 'L', 'P']

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPrice(card: Card): number | null {
  return card.price.usd ?? card.price.eur ?? null
}

function applyClientFilters(cards: Card[], filters: Filters, game: Game): Card[] {
  return cards.filter((c) => {
    if (game !== 'mtg') {
      if (filters.type && c.type_line) {
        if (!c.type_line.toLowerCase().includes(filters.type.toLowerCase())) return false
      }
      if (filters.rarity && c.rarity) {
        if (!c.rarity.toLowerCase().includes(filters.rarity.toLowerCase())) return false
      }
      if (game === 'onepiece' && filters.colors.length > 0) {
        const haystack = `${c.type_line ?? ''} ${c.name}`.toLowerCase()
        if (!filters.colors.some((col) => haystack.includes(col.toLowerCase()))) return false
      }
    }
    const price = getPrice(c)
    if (filters.priceMin !== '' && (price === null || price < parseFloat(filters.priceMin))) return false
    if (filters.priceMax !== '' && (price === null || price > parseFloat(filters.priceMax))) return false
    return true
  })
}

function sortCards(cards: Card[], sort: SortKey): Card[] {
  return [...cards].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name)
    const pa = getPrice(a) ?? -1
    const pb = getPrice(b) ?? -1
    return sort === 'price_asc' ? pa - pb : pb - pa
  })
}

function dedupeById(cards: Card[]): Card[] {
  const seen = new Set<string>()
  return cards.filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: 15 }).map((_, i) => (
        <li key={i} className="rounded-xl border bg-white overflow-hidden animate-pulse">
          <div className="aspect-[2.5/3.5] bg-gray-200" />
          <div className="p-2 space-y-1.5">
            <div className="h-3 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function PriceTag({ price }: { price: Card['price'] }) {
  const val = price.usd ?? price.eur
  if (val == null) return <span className="text-xs text-gray-400">—</span>
  const sym = price.usd != null ? '$' : '€'
  return <span className="text-sm font-semibold text-emerald-600">{sym}{val.toFixed(2)}</span>
}

interface AddToBinderProps {
  card: Card
  binders: { id: string; name: string }[]
}

function AddToBinderButton({ card, binders }: AddToBinderProps) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [done, setDone]   = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function add(binderId: string) {
    setAdding(binderId)
    try {
      await fetch(`/api/binders/${binderId}/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: card.id,
          game: card.game,
          quantity: 1,
          card_name: card.name,
          set_name: card.set_name,
          set_code: card.set_code,
          collector_number: card.collector_number,
          image_url: card.image_url,
          type_line: card.type_line,
          rarity: card.rarity,
        }),
      })
      setDone(binderId)
      setTimeout(() => { setDone(null); setOpen(false) }, 1200)
    } finally {
      setAdding(null)
    }
  }

  if (binders.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-1.5 rounded transition-colors"
      >
        + Add to binder
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border rounded-lg shadow-lg z-20 overflow-hidden">
          {binders.map((b) => (
            <button
              key={b.id}
              onClick={(e) => { e.stopPropagation(); add(b.id) }}
              disabled={!!adding}
              className="w-full text-left text-xs px-3 py-2 hover:bg-indigo-50 flex items-center justify-between disabled:opacity-50"
            >
              <span className="truncate">{b.name}</span>
              {done === b.id   && <span className="text-emerald-500 font-bold ml-1">✓</span>}
              {adding === b.id && <span className="text-gray-400 ml-1">…</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CardGrid({ cards, binders }: { cards: Card[]; binders: { id: string; name: string }[] }) {
  if (cards.length === 0) return null
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {cards.map((card, i) => (
        <li key={`${card.id}-${i}`} className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
          <div className="relative">
            {card.image_url ? (
              <img src={card.image_url} alt={card.name} loading="lazy" className="w-full object-cover" />
            ) : (
              <div className="aspect-[2.5/3.5] bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                No image
              </div>
            )}
          </div>
          <div className="p-2 flex flex-col gap-1 flex-1">
            <p className="text-xs font-semibold leading-tight line-clamp-2 text-gray-900">{card.name}</p>
            <p className="text-xs text-gray-500 truncate">{card.set_name}</p>
            {card.type_line && <p className="text-[10px] text-gray-500 truncate">{card.type_line}</p>}
            <div className="mt-auto pt-1 flex items-center justify-between">
              <PriceTag price={card.price} />
              {card.price.usd_foil != null && (
                <span className="text-[10px] text-purple-600 font-medium">✦ ${card.price.usd_foil.toFixed(2)}</span>
              )}
            </div>
            <AddToBinderButton card={card} binders={binders} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ── Dual range slider ─────────────────────────────────────────────────────────

interface DualRangeSliderProps {
  min?: number
  max?: number
  valueMin: string
  valueMax: string
  onChange: (min: string, max: string) => void
}

function DualRangeSlider({ min = 0, max = PRICE_MAX_SLIDER, valueMin, valueMax, onChange }: DualRangeSliderProps) {
  const lo = valueMin === '' ? min  : Math.min(parseFloat(valueMin) || min,  max)
  const hi = valueMax === '' ? max  : Math.max(parseFloat(valueMax) || max,  min)
  const loPercent = ((lo - min) / (max - min)) * 100
  const hiPercent = ((hi - min) / (max - min)) * 100

  function setLo(v: number) {
    const clamped = Math.min(v, hi - 1)
    onChange(clamped === min ? '' : String(clamped), valueMax)
  }
  function setHi(v: number) {
    const clamped = Math.max(v, lo + 1)
    onChange(valueMin, clamped === max ? '' : String(clamped))
  }

  const thumbCls = [
    'absolute w-full appearance-none bg-transparent',
    '[&::-webkit-slider-thumb]:pointer-events-auto',
    '[&::-webkit-slider-thumb]:appearance-none',
    '[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
    '[&::-webkit-slider-thumb]:rounded-full',
    '[&::-webkit-slider-thumb]:bg-white',
    '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-500',
    '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-sm',
    'pointer-events-none',
  ].join(' ')

  return (
    <div>
      <div className="relative h-6 flex items-center">
        {/* Track background */}
        <div className="absolute w-full h-1.5 bg-gray-200 rounded" />
        {/* Active range */}
        <div
          className="absolute h-1.5 bg-indigo-500 rounded"
          style={{ left: `${loPercent}%`, right: `${100 - hiPercent}%` }}
        />
        {/* Min thumb */}
        <input
          type="range" min={min} max={max} step={1} value={lo}
          onChange={(e) => setLo(parseInt(e.target.value))}
          className={thumbCls}
        />
        {/* Max thumb */}
        <input
          type="range" min={min} max={max} step={1} value={hi}
          onChange={(e) => setHi(parseInt(e.target.value))}
          className={thumbCls}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-600 mt-1.5 font-medium">
        <span>{lo === min ? 'Any' : `$${lo}`}</span>
        <span>{hi === max ? 'Any' : `$${hi}`}</span>
      </div>
    </div>
  )
}

// ── Filter sidebar ───────────────────────────────────────────────────────────

interface FilterSectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function FilterSection({ title, defaultOpen = true, children }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b pb-4 mb-4 last:border-b-0 last:mb-0 last:pb-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-800 mb-2"
      >
        {title}
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && children}
    </div>
  )
}

interface FilterSidebarProps {
  game: Game
  filters: Filters
  sets: SetInfo[]
  setsLoading: boolean
  onChange: (f: Filters) => void
  onClear: () => void
}

function FilterSidebar({ game, filters, sets, setsLoading, onChange, onClear }: FilterSidebarProps) {
  function toggle<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function toggleColor(code: string) {
    const next = filters.colors.includes(code)
      ? filters.colors.filter((c) => c !== code)
      : [...filters.colors, code]
    onChange({ ...filters, colors: next })
  }

  const hasAnyFilter =
    filters.set || filters.colors.length > 0 || filters.type ||
    filters.rarity || filters.priceMin || filters.priceMax

  return (
    <aside className="w-56 shrink-0">
      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Filters</h2>
          {hasAnyFilter && (
            <button onClick={onClear} className="text-xs text-indigo-600 hover:underline">
              Clear all
            </button>
          )}
        </div>

        {/* Set */}
        <FilterSection title="Set / Expansion">
          {setsLoading ? (
            <div className="h-8 bg-gray-100 rounded animate-pulse" />
          ) : (
            <select
              value={filters.set}
              onChange={(e) => toggle('set', e.target.value)}
              className="w-full text-xs text-gray-800 border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All sets</option>
              {sets.map((s) => (
                <option key={s.id} value={s.code ?? s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </FilterSection>

        {/* MTG: Colors */}
        {game === 'mtg' && (
          <FilterSection title="Color">
            <div className="flex flex-wrap gap-1.5">
              {MTG_COLORS.map(({ code, label, bg }) => (
                <button
                  key={code}
                  title={label}
                  onClick={() => toggleColor(code)}
                  className={`w-8 h-8 rounded-full border-2 text-xs font-bold transition-all ${
                    filters.colors.includes(code)
                      ? `${bg} ring-2 ring-indigo-500 ring-offset-1`
                      : 'bg-gray-50 border-gray-300 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </FilterSection>
        )}

        {/* One Piece: Colors */}
        {game === 'onepiece' && (
          <FilterSection title="Color">
            <div className="flex flex-col gap-1">
              {OP_COLORS.map((col) => (
                <label key={col} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.colors.includes(col)}
                    onChange={() => toggleColor(col)}
                    className="accent-indigo-600"
                  />
                  {col}
                </label>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Card Type */}
        <FilterSection title="Card Type">
          <div className="flex flex-col gap-1">
            {(game === 'mtg' ? MTG_TYPES : game === 'pokemon' ? POKEMON_TYPES : OP_TYPES).map((t) => (
              <label key={t} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  checked={filters.type === t}
                  onChange={() => toggle('type', filters.type === t ? '' : t)}
                  className="accent-indigo-600"
                />
                {t}
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Rarity */}
        <FilterSection title="Rarity">
          <div className="flex flex-col gap-1">
            {(game === 'mtg' ? MTG_RARITIES.map((r) => ({ value: r.value, label: r.label }))
              : game === 'pokemon' ? POKEMON_RARITIES.map((r) => ({ value: r, label: r }))
              : OP_RARITIES.map((r) => ({ value: r, label: r }))
            ).map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="rarity"
                  checked={filters.rarity === value}
                  onChange={() => toggle('rarity', filters.rarity === value ? '' : value)}
                  className="accent-indigo-600"
                />
                {label}
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Price range slider */}
        <FilterSection title="Price (USD)">
          <DualRangeSlider
            valueMin={filters.priceMin}
            valueMax={filters.priceMax}
            onChange={(min, max) => onChange({ ...filters, priceMin: min, priceMax: max })}
          />
        </FilterSection>
      </div>
    </aside>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (p: number) => void
}

function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-8">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="px-3 py-1.5 text-sm rounded-lg border bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ← Prev
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`w-9 h-9 text-sm rounded-lg border transition-colors ${
              p === page
                ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-1.5 text-sm rounded-lg border bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

const GAMES: { value: Game; label: string }[] = [
  { value: 'mtg',      label: 'Magic: The Gathering' },
  { value: 'pokemon',  label: 'Pokémon' },
  { value: 'onepiece', label: 'One Piece' },
]

const GAME_SOURCE: Record<Game, { name: string; url: string }> = {
  mtg:      { name: 'Scryfall',    url: 'https://scryfall.com' },
  pokemon:  { name: 'PokéWallet',  url: 'https://www.pokewallet.io' },
  onepiece: { name: 'OPTCG API',   url: 'https://optcgapi.com' },
}

export default function SearchPage() {
  const [query,       setQuery]       = useState('')
  const [game,        setGame]        = useState<Game>('mtg')
  const [filters,     setFilters]     = useState<Filters>(EMPTY_FILTERS)
  const [sort,        setSort]        = useState<SortKey>('name')
  const [result,      setResult]      = useState<CardSearchResult | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [sets,        setSets]        = useState<SetInfo[]>([])
  const [setsLoading, setSetsLoading] = useState(false)
  const [binders,     setBinders]     = useState<{ id: string; name: string }[]>([])
  const [page,        setPage]        = useState(1)

  useEffect(() => {
    fetch('/api/binders')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBinders(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setSets([])
    setSetsLoading(true)
    fetch(`/api/cards/sets?game=${game}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSets(data) })
      .catch(() => {})
      .finally(() => setSetsLoading(false))
  }, [game])

  const search = useCallback(async (q: string, g: Game, f: Filters) => {
    const hasFilter = f.set || f.colors.length > 0 || f.type || f.rarity || f.priceMin || f.priceMax
    if (!q.trim() && !hasFilter) return

    setLoading(true)
    setError(null)
    setPage(1)
    try {
      const params = new URLSearchParams({ game: g })
      if (q.trim()) params.set('q', q.trim())
      if (f.set) params.set('set', f.set)
      if (f.colors.length > 0) params.set('colors', f.colors.join(','))
      if (f.type) params.set('type', f.type)
      if (f.rarity) params.set('rarity', f.rarity)

      const res  = await fetch(`/api/cards/search?${params}`)
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
    search(query, game, filters)
  }

  function handleFilterChange(newFilters: Filters) {
    setFilters(newFilters)
    if (result || newFilters.set) {
      search(query, game, newFilters)
    }
  }

  function handleGameChange(g: Game) {
    setGame(g)
    setFilters(EMPTY_FILTERS)
    setResult(null)
    setError(null)
    setQuery('')
    setPage(1)
  }

  function handleClearFilters() {
    setFilters(EMPTY_FILTERS)
    if (result) search(query, game, EMPTY_FILTERS)
  }

  // Client-side: dedupe, filter by price, sort, then paginate
  const allFiltered = result
    ? sortCards(applyClientFilters(dedupeById(result.cards), filters, game), sort)
    : []

  const totalPages   = Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE))
  const displayCards = allFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Search Cards</h1>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Game tabs */}
        <div className="flex gap-2 mb-5">
          {GAMES.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => handleGameChange(g.value)}
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

        <p className="text-xs text-gray-400 -mt-3 mb-5">
          Card data and pricing from{' '}
          <a
            href={GAME_SOURCE[game].url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            {GAME_SOURCE[game].name}
          </a>
        </p>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards by name…"
            className="flex-1 border rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700 transition-colors"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        <div className="flex gap-6 items-start">
          {/* Sidebar */}
          <FilterSidebar
            game={game}
            filters={filters}
            sets={sets}
            setsLoading={setsLoading}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
          />

          {/* Results */}
          <div className="flex-1 min-w-0">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                {error}
              </div>
            )}

            {(result || loading) && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  {loading ? 'Searching…' : (
                    <>
                      <span className="font-semibold text-gray-900">{allFiltered.length.toLocaleString()}</span>
                      {result && result.total > allFiltered.length && (
                        <span className="text-gray-500"> of {result.total.toLocaleString()}</span>
                      )} result{allFiltered.length !== 1 ? 's' : ''}
                      {result?.has_more && <span className="text-gray-500"> (first page from API)</span>}
                    </>
                  )}
                </p>
                <select
                  value={sort}
                  onChange={(e) => { setSort(e.target.value as SortKey); setPage(1) }}
                  className="text-xs text-gray-700 border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="name">Name A → Z</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                </select>
              </div>
            )}

            {loading && <SkeletonGrid />}

            {!loading && result && <CardGrid cards={displayCards} binders={binders} />}

            {!loading && result && (
              <Pagination page={page} totalPages={totalPages} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
            )}

            {!loading && result && allFiltered.length === 0 && (
              <div className="text-center py-16">
                <p className="font-medium text-gray-700">No cards match your filters.</p>
                <p className="text-sm mt-1 text-gray-500">Try adjusting or clearing your filters.</p>
              </div>
            )}

            {!loading && !result && !error && (
              <div className="text-center py-16">
                <p className="font-medium text-gray-700">Search for cards</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Card, CardSearchResult } from '@/types/card'
import type { Finish } from '@/types/holding'
import type { SetInfo } from '@/app/api/cards/sets/route'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { finishPrice } from '@/lib/holdingValue'
import { useToast } from '@/components/Toast'

// ── Types ────────────────────────────────────────────────────────────────────

type Game = 'mtg' | 'pokemon' | 'onepiece'
type SortKey = 'name' | 'price_asc' | 'price_desc'
type BinderRef = { id: string; name: string; game: Game }

const GAME_LABELS: Record<Game, string> = {
  mtg: 'MTG',
  pokemon: 'Pokémon',
  onepiece: 'One Piece',
}

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
        <li key={i} className="rounded-xl border border-line bg-surface overflow-hidden animate-pulse">
          <div className="aspect-[2.5/3.5] bg-line" />
          <div className="p-2 space-y-1.5">
            <div className="h-3 bg-line rounded w-3/4" />
            <div className="h-3 bg-line rounded w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function PriceTag({ price }: { price: Card['price'] }) {
  const val = price.usd ?? price.eur
  if (val == null) return <span className="text-xs text-muted">—</span>
  const sym = price.usd != null ? '$' : '€'
  return <span className="text-sm font-semibold text-ink">{sym}{val.toFixed(2)}</span>
}

interface AddToBinderProps {
  card: Card
  binders: BinderRef[]
}

function AddToBinderButton({ card, binders }: AddToBinderProps) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [done, setDone]   = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [finish, setFinish] = useState<Finish>('nonfoil')
  const ref = useRef<HTMLDivElement>(null)
  const toast = useToast()

  // A binder holds a single game, so only offer binders matching this card's
  // game — the server rejects mismatches, but don't surface them as options.
  const eligible = binders.filter((b) => b.game === card.game)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function add(binderId: string) {
    setAdding(binderId)
    setFailed(null)
    try {
      const res = await fetch(`/api/binders/${binderId}/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: card.id,
          game: card.game,
          quantity: 1,
          finish,
          card_data: card,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast(json.error ?? 'Failed to add card', 'error')
        setFailed(binderId)
        setTimeout(() => setFailed(null), 1800)
        return
      }
      setDone(binderId)
      setTimeout(() => { setDone(null); setOpen(false) }, 1200)
    } finally {
      setAdding(null)
    }
  }

  if (binders.length === 0) return null

  // Binders exist but none for this game: say so instead of a dead button.
  if (eligible.length === 0) {
    return (
      <button
        type="button"
        disabled
        title={`Create a ${GAME_LABELS[card.game]} binder to add this card`}
        className="microlabel w-full border border-line text-muted py-1.5 rounded cursor-not-allowed"
      >
        No {GAME_LABELS[card.game]} binder
      </button>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="microlabel w-full bg-brand hover:bg-brand-hover text-brand-contrast py-1.5 rounded transition-colors"
      >
        + Add to binder
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 bg-surface border border-line rounded-lg shadow-md z-20 overflow-hidden">
          {/* Finish selector — only offered when the card has a foil printing;
              each option shows its own price so switching changes what's added */}
          {card.price.usd_foil != null && (
            <div className="flex divide-x divide-line border-b border-line" role="group" aria-label="Finish">
              {(['nonfoil', 'foil'] as Finish[]).map((f) => {
                const p = finishPrice(f, card.price)
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFinish(f) }}
                    aria-pressed={finish === f}
                    className={`flex-1 py-1.5 px-1 text-center transition-colors ${
                      finish === f ? 'bg-brand text-brand-contrast' : 'bg-surface text-muted hover:text-ink'
                    }`}
                  >
                    <span className="microlabel block">{f === 'foil' ? 'Foil' : 'Normal'}</span>
                    <span className="block text-[10px] font-mono opacity-90">{p != null ? `$${p.toFixed(2)}` : '—'}</span>
                  </button>
                )
              })}
            </div>
          )}
          {eligible.map((b) => (
            <button
              key={b.id}
              onClick={(e) => { e.stopPropagation(); add(b.id) }}
              disabled={!!adding}
              className="w-full text-left text-xs px-3 py-2 text-ink hover:bg-background flex items-center justify-between disabled:opacity-50 transition-colors"
            >
              <span className="truncate">{b.name}</span>
              {done === b.id   && <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">✓</span>}
              {failed === b.id && <span className="text-red-500 font-bold ml-1" title="Failed to add">✕</span>}
              {adding === b.id && <span className="text-muted ml-1">…</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CardGrid({ cards, binders, onSelect }: { cards: Card[]; binders: BinderRef[]; onSelect: (card: Card) => void }) {
  if (cards.length === 0) return null
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {cards.map((card, i) => (
        <li key={`${card.id}-${i}`} className="bg-surface rounded-xl border border-line overflow-hidden flex flex-col">
          <button
            type="button"
            onClick={() => onSelect(card)}
            className="text-left flex flex-col flex-1 cursor-pointer hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t-xl"
          >
            <div className="relative">
              {card.image_url ? (
                <img src={card.image_url} alt={card.name} loading="lazy" width={250} height={350} className="w-full h-auto object-cover" />
              ) : (
                <div className="aspect-[2.5/3.5] bg-background flex items-center justify-center text-xs text-muted">
                  No image
                </div>
              )}
            </div>
            <div className="p-2 flex flex-col gap-1 flex-1">
              <p className="text-xs font-semibold leading-tight line-clamp-2 text-ink">{card.name}</p>
              <p className="text-xs text-muted truncate">{card.set_name}</p>
              {card.type_line && <p className="text-[10px] text-muted truncate">{card.type_line}</p>}
              <div className="mt-auto pt-1 flex items-center justify-between">
                <PriceTag price={card.price} />
                {card.price.usd_foil != null && (
                  <span className="text-[10px] text-brand font-medium">✦ ${card.price.usd_foil.toFixed(2)}</span>
                )}
              </div>
            </div>
          </button>
          <div className="p-2 pt-0">
            <AddToBinderButton card={card} binders={binders} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ── Card detail modal ─────────────────────────────────────────────────────────

function CardModal({ card, binders, onClose }: { card: Card; binders: BinderRef[]; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const details: { label: string; value: string }[] = []
  if (card.set_name)  details.push({ label: 'Set',    value: card.set_name })
  if (card.type_line) details.push({ label: 'Type',   value: card.type_line })
  if (card.rarity)    details.push({ label: 'Rarity', value: card.rarity })

  const price = card.price.usd ?? card.price.eur
  const priceStr = price != null ? `${card.price.usd != null ? '$' : '€'}${price.toFixed(2)}` : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={card.name}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-line bg-surface">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 w-8 h-8 rounded-md border border-line bg-surface flex items-center justify-center text-muted hover:text-ink hover:border-ink transition-colors"
        >
          ✕
        </button>
        <div className="sm:flex">
          <div className="sm:w-1/2 shrink-0 p-4">
            {card.image_url ? (
              <img src={card.image_url} alt={card.name} width={488} height={680} className="w-full h-auto rounded-lg" />
            ) : (
              <div className="aspect-[2.5/3.5] bg-background rounded-lg flex items-center justify-center text-sm text-muted">
                No image
              </div>
            )}
          </div>
          <div className="sm:w-1/2 p-4 sm:pl-2 flex flex-col">
            <h2 className="text-lg font-bold text-ink pr-8">{card.name}</h2>
            <dl className="mt-4 space-y-3">
              {details.map(d => (
                <div key={d.label}>
                  <dt className="microlabel text-muted">{d.label}</dt>
                  <dd className="text-sm text-ink mt-0.5">{d.value}</dd>
                </div>
              ))}
              <div>
                <dt className="microlabel text-muted">Price</dt>
                <dd className="font-mono text-lg text-ink mt-0.5">
                  {priceStr}
                  {card.price.usd_foil != null && (
                    <span className="ml-2 text-sm text-brand">✦ ${card.price.usd_foil.toFixed(2)} foil</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-6 sm:mt-auto pt-4">
              <AddToBinderButton card={card} binders={binders} />
            </div>
          </div>
        </div>
      </div>
    </div>
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
    '[&::-webkit-slider-thumb]:bg-surface',
    '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand',
    '[&::-webkit-slider-thumb]:cursor-pointer',
    'pointer-events-none',
  ].join(' ')

  return (
    <div>
      <div className="relative h-6 flex items-center">
        {/* Track background */}
        <div className="absolute w-full h-1.5 bg-line rounded" />
        {/* Active range */}
        <div
          className="absolute h-1.5 bg-brand rounded"
          style={{ left: `${loPercent}%`, right: `${100 - hiPercent}%` }}
        />
        {/* Min thumb */}
        <input
          type="range" min={min} max={max} step={1} value={lo}
          onChange={(e) => setLo(parseInt(e.target.value))}
          className={thumbCls}
          aria-label="Minimum price"
        />
        {/* Max thumb */}
        <input
          type="range" min={min} max={max} step={1} value={hi}
          onChange={(e) => setHi(parseInt(e.target.value))}
          className={thumbCls}
          aria-label="Maximum price"
        />
      </div>
      <div className="flex justify-between text-xs text-muted mt-1.5 font-medium">
        <span>{lo === min ? 'Any' : `$${lo}`}</span>
        <span>{hi === max ? 'Any' : `$${hi}`}</span>
      </div>
    </div>
  )
}

// ── Filter panel ─────────────────────────────────────────────────────────────

interface FilterSectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function FilterSection({ title, defaultOpen = true, children }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-line pb-4 mb-4 last:border-b-0 last:mb-0 last:pb-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="microlabel w-full flex items-center justify-between text-ink mb-2"
      >
        {title}
        <span className="text-muted text-[9px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && children}
    </div>
  )
}

interface FilterPanelProps {
  game: Game
  filters: Filters
  sets: SetInfo[]
  setsLoading: boolean
  onChange: (f: Filters) => void
  onClear: () => void
}

function FilterPanel({ game, filters, sets, setsLoading, onChange, onClear }: FilterPanelProps) {
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
    <div className="bg-surface border border-line rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="microlabel text-ink">Filters</h2>
        {hasAnyFilter && (
          <button onClick={onClear} className="text-xs text-brand hover:underline">
            Clear all
          </button>
        )}
      </div>

      {/* Set */}
      <FilterSection title="Set / Expansion">
        {setsLoading ? (
          <div className="h-8 bg-line rounded animate-pulse" />
        ) : (
          <select
            value={filters.set}
            onChange={(e) => toggle('set', e.target.value)}
            className="w-full text-xs text-ink bg-surface border border-line rounded-md px-2 py-1.5 focus:outline-none focus:border-brand"
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
                aria-label={label}
                aria-pressed={filters.colors.includes(code)}
                onClick={() => toggleColor(code)}
                className={`w-8 h-8 rounded-full border-2 text-xs font-bold transition-all ${
                  filters.colors.includes(code)
                    ? `${bg} ring-2 ring-brand ring-offset-1`
                    : 'bg-background border-line text-muted hover:border-ink'
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
              <label key={col} className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.colors.includes(col)}
                  onChange={() => toggleColor(col)}
                  className="accent-brand"
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
            <label key={t} className="flex items-center gap-2 text-xs text-ink cursor-pointer">
              <input
                type="radio"
                name="type"
                checked={filters.type === t}
                onChange={() => toggle('type', filters.type === t ? '' : t)}
                className="accent-brand"
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
            <label key={value} className="flex items-center gap-2 text-xs text-ink cursor-pointer">
              <input
                type="radio"
                name="rarity"
                checked={filters.rarity === value}
                onChange={() => toggle('rarity', filters.rarity === value ? '' : value)}
                className="accent-brand"
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
        className="px-3 py-1.5 text-sm rounded-md border border-line bg-surface text-ink hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← Prev
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-muted text-sm">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`w-9 h-9 text-sm rounded-md border transition-colors ${
              p === page
                ? 'bg-brand text-brand-contrast border-brand font-semibold'
                : 'bg-surface border-line text-ink hover:bg-background'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-1.5 text-sm rounded-md border border-line bg-surface text-ink hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

const GAMES: { value: Game; label: string }[] = [
  { value: 'mtg',      label: 'MTG' },
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
  const [loading,     setLoading]     = useState(false)
  const [sets,        setSets]        = useState<SetInfo[]>([])
  const [setsLoading, setSetsLoading] = useState(false)
  const [binders,     setBinders]     = useState<BinderRef[]>([])
  const [page,        setPage]        = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [modalCard,   setModalCard]   = useState<Card | null>(null)
  const toast = useToast()

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

  // Mobile filter drawer: lock body scroll and close on Escape
  useEffect(() => {
    if (!filtersOpen) return
    document.body.style.overflow = 'hidden'
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setFiltersOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [filtersOpen])

  const search = useCallback(async (q: string, g: Game, f: Filters) => {
    const hasFilter = f.set || f.colors.length > 0 || f.type || f.rarity || f.priceMin || f.priceMax
    if (!q.trim() && !hasFilter) return

    setLoading(true)
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
      toast(e instanceof Error ? e.message : 'Something went wrong.', 'error')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Live search: fire once typing settles (button stays for filter-only searches)
  const debouncedQuery = useDebouncedValue(query)
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) search(debouncedQuery, game, filters)
    // Only react to the settled query; game/filter changes have their own handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery])

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

  const activeFilterCount =
    (filters.set ? 1 : 0) + filters.colors.length + (filters.type ? 1 : 0) +
    (filters.rarity ? 1 : 0) + (filters.priceMin || filters.priceMax ? 1 : 0)

  return (
    <div className="min-h-screen">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Game tabs */}
        <div className="mb-3 flex w-fit divide-x divide-line rounded-md border border-line overflow-hidden">
          {GAMES.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => handleGameChange(g.value)}
              aria-pressed={game === g.value}
              className={`microlabel px-4 py-2 transition-colors ${
                game === g.value
                  ? 'bg-brand text-brand-contrast'
                  : 'bg-surface text-muted hover:text-ink'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted mb-5">
          Card data and pricing from{' '}
          <a
            href={GAME_SOURCE[game].url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-ink"
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
            className="flex-1 rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={loading}
            className="control-label rounded-md bg-brand hover:bg-brand-hover text-brand-contrast px-6 py-2.5 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {/* Mobile filter toggle */}
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="microlabel lg:hidden mb-4 flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-ink"
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded bg-brand px-1.5 py-0.5 text-brand-contrast">{activeFilterCount}</span>
          )}
        </button>

        {/* Mobile filter drawer */}
        {filtersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setFiltersOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] overflow-y-auto bg-background p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="microlabel text-muted">Filters</span>
                <button
                  onClick={() => setFiltersOpen(false)}
                  aria-label="Close filters"
                  className="w-8 h-8 rounded-md border border-line flex items-center justify-center text-muted hover:text-ink"
                >
                  ✕
                </button>
              </div>
              <FilterPanel
                game={game}
                filters={filters}
                sets={sets}
                setsLoading={setsLoading}
                onChange={handleFilterChange}
                onClear={handleClearFilters}
              />
            </div>
          </div>
        )}

        <div className="lg:flex lg:gap-6 lg:items-start">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-56 shrink-0">
            <FilterPanel
              game={game}
              filters={filters}
              sets={sets}
              setsLoading={setsLoading}
              onChange={handleFilterChange}
              onClear={handleClearFilters}
            />
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {(result || loading) && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted">
                  {loading ? 'Searching…' : (
                    <>
                      <span className="font-semibold text-ink">{allFiltered.length.toLocaleString()}</span>
                      {result && result.total > allFiltered.length && (
                        <span> of {result.total.toLocaleString()}</span>
                      )} result{allFiltered.length !== 1 ? 's' : ''}
                    </>
                  )}
                </p>
                <select
                  value={sort}
                  onChange={(e) => { setSort(e.target.value as SortKey); setPage(1) }}
                  className="text-xs text-ink bg-surface border border-line rounded-md px-2 py-1.5 focus:outline-none focus:border-brand"
                >
                  <option value="name">Name A → Z</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                </select>
              </div>
            )}

            {loading && <SkeletonGrid />}

            {!loading && result && <CardGrid cards={displayCards} binders={binders} onSelect={setModalCard} />}

            {!loading && result && (
              <Pagination page={page} totalPages={totalPages} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
            )}

            {!loading && result && allFiltered.length === 0 && (
              <div className="text-center py-16">
                <p className="font-medium text-ink">No cards match your filters.</p>
                <p className="text-sm mt-1 text-muted">Try adjusting or clearing your filters.</p>
              </div>
            )}

            {!loading && !result && (
              <div className="text-center py-16">
                <p className="font-medium text-ink">Search for cards</p>
                <p className="text-sm mt-1 text-muted">Pick a game, type a name, or filter by set to browse.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {modalCard && (
        <CardModal card={modalCard} binders={binders} onClose={() => setModalCard(null)} />
      )}
    </div>
  )
}

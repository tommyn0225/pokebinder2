import type { Card, CardSearchResult, GameAdapter, SearchFilters } from '@/types/card'
import { getCached, setCached } from '@/lib/cache'

const BASE_URL = 'https://api.scryfall.com'
const HEADERS = {
  'User-Agent': 'Binder/1.0 (collection tracker; contact: tommyn0225@gmail.com)',
  'Accept': 'application/json',
}
const TTL = 60 * 60 * 24 // 24h

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCard(raw: any): Card {
  return {
    id: raw.id,
    game: 'mtg',
    name: raw.name,
    set_name: raw.set_name,
    set_code: raw.set,
    collector_number: raw.collector_number,
    image_url: raw.image_uris?.normal ?? raw.card_faces?.[0]?.image_uris?.normal ?? null,
    type_line: raw.type_line ?? null,
    rarity: raw.rarity ?? null,
    price: {
      usd: raw.prices?.usd ? parseFloat(raw.prices.usd) : null,
      usd_foil: raw.prices?.usd_foil ? parseFloat(raw.prices.usd_foil) : null,
      eur: raw.prices?.eur ? parseFloat(raw.prices.eur) : null,
    },
  }
}

function buildScryfallQuery(query: string, filters?: SearchFilters): string {
  const parts: string[] = []
  if (query.trim()) parts.push(query.trim())
  if (filters?.set) parts.push(`e:${filters.set}`)
  if (filters?.colors && filters.colors.length > 0) parts.push(`c:${filters.colors.join('')}`)
  if (filters?.type) parts.push(`t:${filters.type}`)
  if (filters?.rarity) parts.push(`r:${filters.rarity}`)
  // Need at least something to search
  return parts.join(' ') || 'a'
}

// `resolveByName` is MTG-specific (deck-list import resolves cards by exact
// name + optional set), so it lives on the concrete adapter type rather than
// the shared GameAdapter interface. Still assignable to Record<_, GameAdapter>.
export const scryfallAdapter: GameAdapter & {
  resolveByName(name: string, setCode?: string): Promise<Card | null>
} = {
  async search(query: string, filters?: SearchFilters): Promise<CardSearchResult> {
    const builtQuery = buildScryfallQuery(query, filters)
    const key = `scryfall:search:${builtQuery}`
    const cached = await getCached<CardSearchResult>(key)
    if (cached) return cached

    const url = `${BASE_URL}/cards/search?q=${encodeURIComponent(builtQuery)}&order=name`
    const res = await fetch(url, { headers: HEADERS })

    if (res.status === 404) {
      const empty: CardSearchResult = { cards: [], total: 0, has_more: false }
      await setCached(key, empty, TTL)
      return empty
    }
    if (!res.ok) throw new Error(`Scryfall search failed: ${res.status}`)

    const data = await res.json()
    const result: CardSearchResult = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cards: data.data.map((c: any) => mapCard(c)),
      total: data.total_cards,
      has_more: data.has_more,
    }
    await setCached(key, result, TTL)
    return result
  },

  async getById(id: string): Promise<Card | null> {
    const key = `scryfall:card:${id}`
    const cached = await getCached<Card>(key)
    if (cached) return cached

    const res = await fetch(`${BASE_URL}/cards/${id}`, { headers: HEADERS })
    if (!res.ok) return null
    const card = mapCard(await res.json())
    await setCached(key, card, TTL)
    return card
  },

  async resolveByName(name: string, setCode?: string): Promise<Card | null> {
    const set = setCode?.trim().toLowerCase() || ''
    const key = `scryfall:named:${name.toLowerCase()}:${set}`
    const cached = await getCached<Card | null>(key)
    if (cached !== null) return cached

    // Exact-name lookup, optionally scoped to a printing. If the requested set
    // has no such card (404), fall back to the exact name in any set so a bad
    // set code degrades to "matched, wrong printing" rather than "unmatched".
    const named = async (withSet: boolean): Promise<Card | null> => {
      const params = new URLSearchParams({ exact: name })
      if (withSet && set) params.set('set', set)
      const res = await fetch(`${BASE_URL}/cards/named?${params}`, { headers: HEADERS })
      if (!res.ok) return null
      return mapCard(await res.json())
    }

    let card = await named(Boolean(set))
    if (!card && set) card = await named(false)
    await setCached(key, card, TTL)
    return card
  },

  async getPrintings(name: string): Promise<Card[]> {
    const key = `scryfall:printings:${name.toLowerCase()}`
    const cached = await getCached<Card[]>(key)
    if (cached) return cached

    // Exact-name match, every printing, oldest release first so the picker
    // reads chronologically (original → reprints).
    const q = `!"${name}" unique:prints`
    const url = `${BASE_URL}/cards/search?q=${encodeURIComponent(q)}&order=released&dir=asc`
    const res = await fetch(url, { headers: HEADERS })

    if (res.status === 404) {
      await setCached(key, [], TTL)
      return []
    }
    if (!res.ok) throw new Error(`Scryfall printings failed: ${res.status}`)

    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const printings: Card[] = data.data.map((c: any) => mapCard(c))
    await setCached(key, printings, TTL)
    return printings
  },
}

import type { Card, CardSearchResult, GameAdapter, SearchFilters } from '@/types/card'
import { getCached, setCached } from '@/lib/cache'

const BASE_URL = 'https://api.pokewallet.io'
const TTL = 60 * 60 * 24 // 24h

function getHeaders(): HeadersInit {
  const key = process.env.POKEWALLET_API_KEY
  if (!key) throw new Error('POKEWALLET_API_KEY is not set')
  return {
    'X-API-Key': key,
    'Accept': 'application/json',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCard(raw: any): Card {
  return {
    id: raw.id,
    game: 'onepiece',
    name: raw.name,
    set_name: raw.set_name ?? '',
    set_code: raw.card_number?.split('-')[0] ?? '',
    collector_number: raw.card_number ?? '',
    image_url: `/api/cards/image?id=${encodeURIComponent(raw.id)}`,
    type_line: raw.card_type ?? null,
    rarity: raw.rarity ?? null,
    price: {
      usd: raw.tcgplayer?.prices?.market_price ?? null,
      usd_foil: null,
      eur: raw.cardmarket?.prices?.avg ?? null,
    },
  }
}

export const optcgAdapter: GameAdapter = {
  async search(query: string, filters?: SearchFilters): Promise<CardSearchResult> {
    const setId = filters?.set
    let url: string
    let key: string

    if (setId && !query.trim()) {
      key = `optcg:set:${setId}`
      url = `${BASE_URL}/op/sets/${encodeURIComponent(setId)}?limit=200`
    } else {
      key = `optcg:search:${query}`
      url = `${BASE_URL}/op/search?q=${encodeURIComponent(query)}&limit=100`
    }

    const cached = await getCached<CardSearchResult>(key)
    if (cached) return cached

    const res = await fetch(url, { headers: getHeaders() })

    if (res.status === 404) {
      const empty: CardSearchResult = { cards: [], total: 0, has_more: false }
      await setCached(key, empty, TTL)
      return empty
    }
    if (!res.ok) throw new Error(`One Piece search failed: ${res.status}`)

    const data = await res.json()
    const raw = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []
    const result: CardSearchResult = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cards: raw.map((c: any) => mapCard(c)),
      total: data.total ?? raw.length,
      has_more: (data.page ?? 1) * (data.limit ?? 100) < (data.total ?? 0),
    }
    await setCached(key, result, TTL)
    return result
  },

  async getById(id: string): Promise<Card | null> {
    const key = `optcg:card:${id}`
    const cached = await getCached<Card>(key)
    if (cached) return cached

    const res = await fetch(`${BASE_URL}/op/cards/${encodeURIComponent(id)}`, {
      headers: getHeaders(),
    })
    if (!res.ok) return null
    const data = await res.json()
    const card = mapCard(data)
    await setCached(key, card, TTL)
    return card
  },
}

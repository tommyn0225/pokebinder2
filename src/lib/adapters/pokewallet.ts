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
  const normalPrice: number | null =
    raw.tcgplayer?.prices?.find((p: any) => p.sub_type_name === 'Normal')?.market_price ??
    raw.tcgplayer?.prices?.[0]?.market_price ??
    null

  const holoPrice: number | null =
    raw.tcgplayer?.prices?.find((p: any) => p.sub_type_name === 'Holofoil')?.market_price ??
    null

  return {
    id: raw.id,
    game: 'pokemon',
    name: raw.card_info?.name ?? raw.id,
    set_name: raw.card_info?.set_name ?? '',
    set_code: raw.card_info?.set_code ?? '',
    collector_number: raw.card_info?.card_number ?? '',
    image_url: `/api/cards/image?id=${encodeURIComponent(raw.id)}`,
    type_line: raw.card_info?.card_type ?? null,
    rarity: raw.card_info?.rarity ?? null,
    price: {
      usd: normalPrice,
      usd_foil: holoPrice,
      eur: raw.cardmarket?.prices?.[0]?.avg ?? null,
    },
  }
}

export const pokewalletAdapter: GameAdapter = {
  async search(query: string, filters?: SearchFilters): Promise<CardSearchResult> {
    // If a set is selected and no query, browse the set directly
    const setId = filters?.set
    let url: string
    let key: string

    if (setId && !query.trim()) {
      key = `pokewallet:set:${setId}`
      url = `${BASE_URL}/sets/${encodeURIComponent(setId)}?limit=100`
    } else {
      const q = setId ? `${query.trim()} ${setId}`.trim() : query.trim()
      key = `pokewallet:search:${q}`
      url = `${BASE_URL}/search?q=${encodeURIComponent(q)}&limit=100`
    }

    const cached = await getCached<CardSearchResult>(key)
    if (cached) return cached

    const res = await fetch(url, { headers: getHeaders() })

    if (res.status === 404) {
      const empty: CardSearchResult = { cards: [], total: 0, has_more: false }
      await setCached(key, empty, TTL)
      return empty
    }
    if (!res.ok) throw new Error(`PokéWallet search failed: ${res.status}`)

    const data = await res.json()
    const raw = Array.isArray(data.results) ? data.results
      : Array.isArray(data.data) ? data.data
      : Array.isArray(data) ? data
      : []
    const result: CardSearchResult = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cards: raw.map((c: any) => mapCard(c)),
      total: data.total ?? raw.length,
      has_more: data.has_more ?? false,
    }
    await setCached(key, result, TTL)
    return result
  },

  async getById(id: string): Promise<Card | null> {
    const key = `pokewallet:card:${id}`
    const cached = await getCached<Card>(key)
    if (cached) return cached

    const res = await fetch(`${BASE_URL}/cards/${id}`, { headers: getHeaders() })
    if (!res.ok) return null
    const card = mapCard(await res.json())
    await setCached(key, card, TTL)
    return card
  },
}

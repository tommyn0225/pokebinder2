import type { Card, CardSearchResult, GameAdapter } from '@/types/card'

const BASE_URL = 'https://api.scryfall.com'
const HEADERS = {
  'User-Agent': 'PokeBinder/1.0 (collection tracker; contact: tommyn0225@gmail.com)',
  'Accept': 'application/json',
}

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

export const scryfallAdapter: GameAdapter = {
  async search(query: string): Promise<CardSearchResult> {
    const url = `${BASE_URL}/cards/search?q=${encodeURIComponent(query)}&order=name`
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } })

    if (res.status === 404) return { cards: [], total: 0, has_more: false }
    if (!res.ok) throw new Error(`Scryfall search failed: ${res.status}`)

    const data = await res.json()
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cards: data.data.map((c: any) => mapCard(c)),
      total: data.total_cards,
      has_more: data.has_more,
    }
  },

  async getById(id: string): Promise<Card | null> {
    const res = await fetch(`${BASE_URL}/cards/${id}`, { headers: HEADERS, next: { revalidate: 300 } })
    if (!res.ok) return null
    return mapCard(await res.json())
  },
}

import type { Card, CardSearchResult, GameAdapter } from '@/types/card'

const BASE_URL = 'https://optcgapi.com/api'
const HEADERS = { 'Accept': 'application/json' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCard(raw: any): Card {
  return {
    id: raw.card_set_id,
    game: 'onepiece',
    name: raw.card_name,
    set_name: raw.set_name ?? '',
    set_code: raw.set_id ?? '',
    collector_number: raw.card_set_id ?? '',
    image_url: raw.card_image ?? null,
    type_line: raw.card_type ?? null,
    rarity: raw.rarity ?? null,
    price: {
      usd: raw.market_price ?? null,
      usd_foil: null,
      eur: null,
    },
  }
}

async function fetchFiltered(endpoint: string, query: string): Promise<Card[]> {
  const url = `${BASE_URL}/${endpoint}/?card_name=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } })
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((c: any) => mapCard(c))
}

export const optcgAdapter: GameAdapter = {
  async search(query: string): Promise<CardSearchResult> {
    const [sets, decks, promos] = await Promise.all([
      fetchFiltered('sets/filtered', query),
      fetchFiltered('decks/filtered', query),
      fetchFiltered('promos/filtered', query),
    ])

    const seen = new Set<string>()
    const all = [...sets, ...decks, ...promos].filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
    return { cards: all, total: all.length, has_more: false }
  },

  async getById(id: string): Promise<Card | null> {
    // Try sets first, then decks, then promos
    const endpoints = ['sets/card', 'decks/card', 'promos/card']
    for (const ep of endpoints) {
      const res = await fetch(`${BASE_URL}/${ep}/${id}/`, { headers: HEADERS, next: { revalidate: 300 } })
      if (!res.ok) continue
      const data = await res.json()
      const card = Array.isArray(data) ? data[0] : data
      if (card) return mapCard(card)
    }
    return null
  },
}

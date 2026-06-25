import type { Card, CardSearchResult, GameAdapter } from '@/types/card'

const BASE_URL = 'https://api.pokewallet.io'

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
  async search(query: string): Promise<CardSearchResult> {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&limit=20`
    const res = await fetch(url, { headers: getHeaders(), next: { revalidate: 300 } })

    if (res.status === 404) return { cards: [], total: 0, has_more: false }
    if (!res.ok) throw new Error(`PokéWallet search failed: ${res.status}`)

    const data = await res.json()
    const cards = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : [])
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cards: cards.map((c: any) => mapCard(c)),
      total: data.total ?? cards.length,
      has_more: data.has_more ?? false,
    }
  },

  async getById(id: string): Promise<Card | null> {
    const res = await fetch(`${BASE_URL}/cards/${id}`, { headers: getHeaders(), next: { revalidate: 300 } })
    if (!res.ok) return null
    return mapCard(await res.json())
  },
}

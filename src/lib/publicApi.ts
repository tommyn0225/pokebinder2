import type { Card } from '@/types/card'

// Attribution is a license condition of our upstream sources and must ride along
// with every public API response (see CLAUDE.md "Respect upstream terms").
export const ATTRIBUTION =
  'Card data and pricing courtesy of Scryfall (MTG), PokéWallet (Pokémon), and OPTCG API (One Piece). ' +
  'Binder is an independent, non-commercial tool and exposes only its own value-added layer (binders, holdings, valuation, price history).'

// Public, read-only endpoints: allow cross-origin GETs and cache briefly.
export const V1_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
}

export interface ApiCard {
  card_id: string
  name: string
  game: Card['game']
  set_name: string
  set_code: string
  collector_number: string
  rarity: string | null
  image_url: string | null
  quantity: number
  for_trade?: boolean
  price: Card['price']
}

export function serializeHolding(
  h: { quantity: number; for_trade?: boolean; card_data: Card },
  opts: { includeForTrade?: boolean } = {}
): ApiCard {
  const c = h.card_data
  const card: ApiCard = {
    card_id: c.id,
    name: c.name,
    game: c.game,
    set_name: c.set_name,
    set_code: c.set_code,
    collector_number: c.collector_number,
    rarity: c.rarity,
    image_url: c.image_url,
    quantity: h.quantity,
    price: c.price,
  }
  if (opts.includeForTrade) card.for_trade = h.for_trade ?? false
  return card
}

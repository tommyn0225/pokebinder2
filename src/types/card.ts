export interface CardPrice {
  usd: number | null
  usd_foil: number | null
  eur: number | null
}

export interface Card {
  id: string
  game: 'mtg' | 'pokemon' | 'onepiece'
  name: string
  set_name: string
  set_code: string
  collector_number: string
  image_url: string | null
  type_line: string | null
  rarity: string | null
  price: CardPrice
}

export interface CardSearchResult {
  cards: Card[]
  total: number
  has_more: boolean
}

export interface SearchFilters {
  set?: string        // set code or id
  colors?: string[]   // MTG: W U B R G C
  type?: string       // card type
  rarity?: string     // common uncommon rare mythic
  priceMin?: number
  priceMax?: number
}

export interface GameAdapter {
  search(query: string, filters?: SearchFilters): Promise<CardSearchResult>
  getById(id: string): Promise<Card | null>
  // Optional: every printing of a card by exact name, so a user can pick a
  // specific set/version (MTG only — Pokémon/One Piece searches already return
  // per-set rows, so they leave this unimplemented).
  getPrintings?(name: string): Promise<Card[]>
}

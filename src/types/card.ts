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
}

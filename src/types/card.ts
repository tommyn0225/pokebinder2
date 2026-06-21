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

export interface GameAdapter {
  search(query: string): Promise<CardSearchResult>
  getById(id: string): Promise<Card | null>
}

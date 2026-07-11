import type { Card } from './card'

export type Finish = 'nonfoil' | 'foil'

export interface Holding {
  id: string
  binder_id: string
  user_id: string
  card_id: string
  game: string
  quantity: number
  finish: Finish
  for_trade: boolean
  acquired_price_usd: number | null
  acquired_at: string
  card_data: Card
  created_at: string
}

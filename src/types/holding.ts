import type { Card } from './card'

export interface Holding {
  id: string
  binder_id: string
  user_id: string
  card_id: string
  game: string
  quantity: number
  card_data: Card
  created_at: string
}

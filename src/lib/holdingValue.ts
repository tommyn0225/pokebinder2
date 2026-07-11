import type { CardPrice } from '@/types/card'

// The finish-appropriate market price for a card, or null when unknown.
// Foil holdings value against usd_foil, falling back to the nonfoil price so a
// card with no foil price still counts rather than silently dropping to zero.
export function finishPrice(finish: string | undefined, price: CardPrice): number | null {
  if (finish === 'foil') return price.usd_foil ?? price.usd
  return price.usd
}

// A holding's per-copy value for summation. The single source of truth for how
// finish maps to a price — every valuation site (binder value, collection
// value, share pages, v1, the snapshot job) must go through here so they agree.
export function holdingUnitPrice(h: { finish?: string; card_data: { price: CardPrice } }): number {
  return finishPrice(h.finish, h.card_data.price) ?? 0
}

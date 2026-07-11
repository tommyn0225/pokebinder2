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

// A holding's recorded cost, or null when the user never recorded what they
// paid. Null is "unknown" (excluded from cost basis), not zero.
export function holdingCost(h: { quantity: number; acquired_price_usd: number | null }): number | null {
  return h.acquired_price_usd == null ? null : h.acquired_price_usd * h.quantity
}

export interface Gain {
  value: number        // current market value of the costed holdings
  cost_basis: number   // total recorded cost of those holdings
  gain: number         // value - cost_basis
  gain_pct: number | null // gain / cost_basis, null when cost_basis is 0
  costed_count: number    // holdings included (have a recorded cost)
  uncosted_count: number  // holdings excluded (cost unknown)
}

// Roll up gain/loss across holdings. Only holdings with a recorded cost count
// toward cost_basis and gain; the rest are reported as uncosted so the UI can
// say how many were left out rather than pretending they cost $0. `value` here
// is the market value of the *costed* holdings only, so gain and cost_basis are
// comparing like with like (the headline total value is computed separately).
export function summarizeGain(
  holdings: Array<{ quantity: number; finish?: string; acquired_price_usd: number | null; card_data: { price: CardPrice } }>
): Gain {
  let value = 0
  let cost_basis = 0
  let costed_count = 0
  let uncosted_count = 0
  for (const h of holdings) {
    const cost = holdingCost(h)
    if (cost == null) { uncosted_count++; continue }
    value += holdingUnitPrice(h) * h.quantity
    cost_basis += cost
    costed_count++
  }
  const gain = value - cost_basis
  return {
    value: Math.round(value * 100) / 100,
    cost_basis: Math.round(cost_basis * 100) / 100,
    gain: Math.round(gain * 100) / 100,
    gain_pct: cost_basis > 0 ? gain / cost_basis : null,
    costed_count,
    uncosted_count,
  }
}

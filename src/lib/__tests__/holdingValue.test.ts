import { describe, expect, it } from 'vitest'
import { finishPrice, holdingUnitPrice, holdingCost, summarizeGain } from '@/lib/holdingValue'
import type { CardPrice } from '@/types/card'

const price = (usd: number | null, usd_foil: number | null = null): CardPrice => ({
  usd,
  usd_foil,
  eur: null,
})

describe('finishPrice', () => {
  it('uses the nonfoil price for a nonfoil (or unspecified) finish', () => {
    expect(finishPrice('nonfoil', price(5, 20))).toBe(5)
    expect(finishPrice(undefined, price(5, 20))).toBe(5)
  })

  it('uses the foil price for a foil finish', () => {
    expect(finishPrice('foil', price(5, 20))).toBe(20)
  })

  it('falls back to the nonfoil price when a foil holding has no foil price', () => {
    expect(finishPrice('foil', price(5, null))).toBe(5)
  })

  it('returns null when the relevant price is missing', () => {
    expect(finishPrice('nonfoil', price(null))).toBeNull()
    expect(finishPrice('foil', price(null, null))).toBeNull()
  })
})

describe('holdingUnitPrice', () => {
  it('honors finish and coalesces an unknown price to 0 for summation', () => {
    expect(holdingUnitPrice({ finish: 'foil', card_data: { price: price(5, 20) } })).toBe(20)
    expect(holdingUnitPrice({ finish: 'nonfoil', card_data: { price: price(5, 20) } })).toBe(5)
    expect(holdingUnitPrice({ finish: 'nonfoil', card_data: { price: price(null) } })).toBe(0)
  })
})

describe('holdingCost', () => {
  it('multiplies recorded per-copy cost by quantity', () => {
    expect(holdingCost({ quantity: 3, acquired_price_usd: 4 })).toBe(12)
  })

  it('returns null when cost is unknown', () => {
    expect(holdingCost({ quantity: 3, acquired_price_usd: null })).toBeNull()
  })
})

describe('summarizeGain', () => {
  it('rolls up gain over only the costed holdings and reports exclusions', () => {
    const g = summarizeGain([
      // paid 5/copy ×2 = 10 cost, now worth 20/copy nonfoil? no: value uses unit price
      { quantity: 2, finish: 'nonfoil', acquired_price_usd: 5, card_data: { price: price(8) } },   // cost 10, value 16
      { quantity: 1, finish: 'foil', acquired_price_usd: 10, card_data: { price: price(8, 30) } }, // cost 10, value 30
      { quantity: 4, finish: 'nonfoil', acquired_price_usd: null, card_data: { price: price(2) } }, // excluded
    ])
    expect(g.cost_basis).toBe(20)
    expect(g.value).toBe(46)
    expect(g.gain).toBe(26)
    expect(g.gain_pct).toBeCloseTo(1.3) // 26 / 20
    expect(g.costed_count).toBe(2)
    expect(g.uncosted_count).toBe(1)
  })

  it('reports null gain_pct when nothing has a cost', () => {
    const g = summarizeGain([
      { quantity: 1, finish: 'nonfoil', acquired_price_usd: null, card_data: { price: price(5) } },
    ])
    expect(g.cost_basis).toBe(0)
    expect(g.gain_pct).toBeNull()
    expect(g.costed_count).toBe(0)
    expect(g.uncosted_count).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'
import { finishPrice, holdingUnitPrice } from '@/lib/holdingValue'
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

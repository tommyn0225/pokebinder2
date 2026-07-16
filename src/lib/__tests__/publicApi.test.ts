import { describe, expect, it } from 'vitest'
import { v1Error, v1Json, serializeHolding, serializeCard, toAbsoluteUrl } from '@/lib/publicApi'
import type { Card } from '@/types/card'

const sampleCard: Card = {
  id: 'abc-123',
  game: 'mtg',
  name: 'Lightning Bolt',
  set_name: 'Magic 2011',
  set_code: 'm11',
  collector_number: '149',
  image_url: null,
  type_line: 'Instant',
  rarity: 'common',
  price: { usd: 1.25, usd_foil: 6, eur: null },
}

describe('v1Error', () => {
  it('wraps errors in the { error: { code, message } } envelope with v1 headers', async () => {
    const res = v1Error(404, 'not_found', 'Nope')
    expect(res.status).toBe(404)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Nope' } })
  })
})

describe('v1Json', () => {
  it('returns the body with an ETag on a fresh request', async () => {
    const req = new Request('http://x/api/v1/cards')
    const res = v1Json(req, { hello: 'world' })
    expect(res.status).toBe(200)
    expect(res.headers.get('ETag')).toBeTruthy()
    expect(await res.json()).toEqual({ hello: 'world' })
  })

  it('returns 304 when If-None-Match matches the payload ETag', () => {
    const body = { hello: 'world' }
    const etag = v1Json(new Request('http://x/api/v1/cards'), body).headers.get('ETag')!
    const res = v1Json(new Request('http://x/api/v1/cards', { headers: { 'If-None-Match': etag } }), body)
    expect(res.status).toBe(304)
  })

  it('changes the ETag when the body changes', () => {
    const a = v1Json(new Request('http://x'), { n: 1 }).headers.get('ETag')
    const b = v1Json(new Request('http://x'), { n: 2 }).headers.get('ETag')
    expect(a).not.toBe(b)
  })
})

describe('toAbsoluteUrl', () => {
  const origin = 'https://binder.example'

  it('rewrites a relative proxy path to absolute', () => {
    expect(toAbsoluteUrl('/api/cards/image?id=pk_1', origin)).toBe(
      'https://binder.example/api/cards/image?id=pk_1'
    )
  })

  it('leaves an already-absolute URL unchanged', () => {
    expect(toAbsoluteUrl('https://cards.scryfall.io/x.jpg', origin)).toBe(
      'https://cards.scryfall.io/x.jpg'
    )
  })

  it('passes null through', () => {
    expect(toAbsoluteUrl(null, origin)).toBeNull()
  })
})

describe('serializers make image_url absolute when given an origin', () => {
  const origin = 'https://binder.example'
  const relCard: Card = { ...sampleCard, image_url: '/api/cards/image?id=pk_1' }

  it('serializeCard rewrites a relative image_url', () => {
    expect(serializeCard(relCard, origin).image_url).toBe(
      'https://binder.example/api/cards/image?id=pk_1'
    )
  })

  it('serializeHolding rewrites a relative image_url', () => {
    const h = serializeHolding({ quantity: 1, card_data: relCard }, { origin })
    expect(h.image_url).toBe('https://binder.example/api/cards/image?id=pk_1')
  })

  it('leaves image_url relative when no origin is passed', () => {
    expect(serializeCard(relCard).image_url).toBe('/api/cards/image?id=pk_1')
  })
})

describe('serializers carry finish correctly', () => {
  it('serializeHolding includes finish; serializeCard (catalog) omits it', () => {
    const holding = serializeHolding({ quantity: 2, finish: 'foil', card_data: sampleCard })
    expect(holding.finish).toBe('foil')
    expect(holding.quantity).toBe(2)

    const catalog = serializeCard(sampleCard) as Record<string, unknown>
    expect('finish' in catalog).toBe(false)
    expect('quantity' in catalog).toBe(false)
  })
})

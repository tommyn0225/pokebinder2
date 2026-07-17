import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Card } from '@/types/card'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

import { GET } from '../route'
import { createServiceClient } from '@/lib/supabase/service'

function sampleCard(): Card {
  return {
    id: 'base1-4',
    game: 'pokemon',
    name: 'Charizard',
    set_name: 'Base Set',
    set_code: 'base1',
    collector_number: '4',
    image_url: 'https://img/charizard.jpg',
    type_line: null,
    rarity: 'Rare Holo',
    price: { usd: 300, usd_foil: null, eur: null },
  }
}

// Fake Supabase exposing only .rpc(), keyed by function name. `hits` drives the
// demo counter; `hitsError` simulates the limiter being unreachable.
function makeFakeSupabase(opts: {
  hits?: number
  hitsError?: unknown
  catalog?: Array<{ card_data: Card }>
}) {
  const calls: Array<{ fn: string; params: Record<string, unknown> }> = []
  return {
    calls,
    rpc(fn: string, params: Record<string, unknown>) {
      calls.push({ fn, params })
      if (fn === 'hit_rate_limit_count') {
        return Promise.resolve({ data: opts.hitsError ? null : opts.hits, error: opts.hitsError ?? null })
      }
      if (fn === 'catalog_page') {
        return Promise.resolve({ data: opts.catalog ?? [], error: null })
      }
      return Promise.resolve({ data: null, error: null })
    },
  }
}

function getRequest(query = '') {
  return new Request(`http://localhost/api/demo/cards${query}`)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('demo cards playground endpoint', () => {
  it('returns catalog cards and decrements remaining under the cap', async () => {
    const fake = makeFakeSupabase({ hits: 1, catalog: [{ card_data: sampleCard() }] })
    vi.mocked(createServiceClient).mockReturnValue(fake as never)

    const res = await GET(getRequest('?q=charizard'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.count).toBe(1)
    expect(body.cards[0].name).toBe('Charizard')
    expect(body.demo).toEqual({ limit: 3, remaining: 2 })
    // Both the limiter and the catalog query ran.
    expect(fake.calls.map((c) => c.fn)).toEqual(['hit_rate_limit_count', 'catalog_page'])
  })

  it('returns the third pull (remaining 0) but blocks the fourth', async () => {
    const third = makeFakeSupabase({ hits: 3, catalog: [{ card_data: sampleCard() }] })
    vi.mocked(createServiceClient).mockReturnValue(third as never)
    const thirdRes = await GET(getRequest())
    const thirdBody = await thirdRes.json()
    expect(thirdRes.status).toBe(200)
    expect(thirdBody.demo.remaining).toBe(0)

    const fourth = makeFakeSupabase({ hits: 4, catalog: [{ card_data: sampleCard() }] })
    vi.mocked(createServiceClient).mockReturnValue(fourth as never)
    const fourthRes = await GET(getRequest())
    const fourthBody = await fourthRes.json()

    expect(fourthRes.status).toBe(429)
    expect(fourthBody.error.code).toBe('rate_limited')
    expect(fourthBody.demo.remaining).toBe(0)
    expect(fourthRes.headers.get('Retry-After')).toBeTruthy()
    // Over the cap, the catalog is never queried.
    expect(fourth.calls.map((c) => c.fn)).toEqual(['hit_rate_limit_count'])
  })

  it('rejects an unknown game before touching the limiter', async () => {
    const fake = makeFakeSupabase({ hits: 1 })
    vi.mocked(createServiceClient).mockReturnValue(fake as never)

    const res = await GET(getRequest('?game=yugioh'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('invalid_request')
    expect(fake.calls).toHaveLength(0)
  })

  it('fails open (serves cards) when the limiter is unreachable', async () => {
    const fake = makeFakeSupabase({ hitsError: { code: 'PGRST202' }, catalog: [{ card_data: sampleCard() }] })
    vi.mocked(createServiceClient).mockReturnValue(fake as never)

    const res = await GET(getRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.count).toBe(1)
    // Remaining falls back to the full cap rather than blocking.
    expect(body.demo.remaining).toBe(3)
  })
})

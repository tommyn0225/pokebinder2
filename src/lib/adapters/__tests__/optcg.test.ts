import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}))

import { optcgAdapter } from '@/lib/adapters/optcg'

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

// Shape-accurate OPTCG card: set_code is derived from the card_number prefix,
// and prices are single objects (not arrays like PokéWallet).
const sampleCard = {
  id: 'OP01-001',
  name: 'Roronoa Zoro',
  set_name: 'Romance Dawn',
  card_number: 'OP01-001',
  card_type: 'Character',
  rarity: 'SR',
  tcgplayer: { prices: { market_price: 12.34 } },
  cardmarket: { prices: { avg: 11.0 } },
}

beforeEach(() => {
  vi.stubEnv('POKEWALLET_API_KEY', 'test-key')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('optcgAdapter.search', () => {
  it('normalizes an upstream card and derives set_code from card_number', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { data: [sampleCard], total: 1 }))

    const result = await optcgAdapter.search('zoro')

    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]).toEqual({
      id: 'OP01-001',
      game: 'onepiece',
      name: 'Roronoa Zoro',
      set_name: 'Romance Dawn',
      set_code: 'OP01',
      collector_number: 'OP01-001',
      image_url: '/api/cards/image?id=OP01-001',
      type_line: 'Character',
      rarity: 'SR',
      price: { usd: 12.34, usd_foil: null, eur: 11.0 },
    })
  })

  it('null-fills prices when the pricing objects are absent', async () => {
    const { tcgplayer, cardmarket, ...noPrices } = sampleCard
    void tcgplayer
    void cardmarket
    vi.stubGlobal('fetch', mockFetch(200, { data: [noPrices], total: 1 }))

    const { cards } = await optcgAdapter.search('zoro')
    expect(cards[0].price).toEqual({ usd: null, usd_foil: null, eur: null })
  })

  it('unwraps a bare-array response body', async () => {
    vi.stubGlobal('fetch', mockFetch(200, [sampleCard]))

    const result = await optcgAdapter.search('zoro')
    expect(result.cards).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('returns an empty result on a 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}))
    expect(await optcgAdapter.search('nope')).toEqual({ cards: [], total: 0, has_more: false })
  })

  it('throws on a non-404 upstream error', async () => {
    vi.stubGlobal('fetch', mockFetch(503, {}))
    await expect(optcgAdapter.search('x')).rejects.toThrow(/One Piece search failed: 503/)
  })
})

describe('optcgAdapter.getById', () => {
  it('normalizes a single card lookup', async () => {
    vi.stubGlobal('fetch', mockFetch(200, sampleCard))

    const card = await optcgAdapter.getById('OP01-001')
    expect(card).toMatchObject({ id: 'OP01-001', game: 'onepiece', set_code: 'OP01' })
    expect(card?.price.usd).toBe(12.34)
  })

  it('returns null when the card is not found', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}))
    expect(await optcgAdapter.getById('missing')).toBeNull()
  })
})

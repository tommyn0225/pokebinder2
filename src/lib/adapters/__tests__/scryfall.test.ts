import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Force every cache read to miss so the adapter always exercises its real
// fetch + mapping path; swallow writes so nothing touches Supabase.
vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}))

import { scryfallAdapter } from '@/lib/adapters/scryfall'

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

// A trimmed-down but shape-accurate Scryfall card payload.
const sampleCard = {
  id: 'abc-123',
  name: 'Lightning Bolt',
  set_name: 'Magic 2010',
  set: 'm10',
  collector_number: '146',
  image_uris: { normal: 'https://img.scryfall/bolt.jpg' },
  type_line: 'Instant',
  rarity: 'common',
  prices: { usd: '1.23', usd_foil: '9.99', eur: '0.85' },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('scryfallAdapter.search', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      mockFetch(200, { data: [sampleCard], total_cards: 1, has_more: false })
    )
  })

  it('normalizes an upstream card into the internal model', async () => {
    const result = await scryfallAdapter.search('bolt')

    expect(result.total).toBe(1)
    expect(result.has_more).toBe(false)
    expect(result.cards).toHaveLength(1)

    expect(result.cards[0]).toEqual({
      id: 'abc-123',
      game: 'mtg',
      name: 'Lightning Bolt',
      set_name: 'Magic 2010',
      set_code: 'm10',
      collector_number: '146',
      image_url: 'https://img.scryfall/bolt.jpg',
      type_line: 'Instant',
      rarity: 'common',
      price: { usd: 1.23, usd_foil: 9.99, eur: 0.85 },
    })
  })

  it('parses string prices into numbers and null-fills missing ones', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(200, {
        data: [{ ...sampleCard, prices: { usd: '5.00', usd_foil: null, eur: undefined } }],
        total_cards: 1,
        has_more: false,
      })
    )

    const { cards } = await scryfallAdapter.search('bolt')
    expect(cards[0].price).toEqual({ usd: 5, usd_foil: null, eur: null })
  })

  it('falls back to card_faces image when top-level image_uris is absent', async () => {
    const { image_uris, ...noImage } = sampleCard
    void image_uris
    vi.stubGlobal(
      'fetch',
      mockFetch(200, {
        data: [{ ...noImage, card_faces: [{ image_uris: { normal: 'https://img/face.jpg' } }] }],
        total_cards: 1,
        has_more: false,
      })
    )

    const { cards } = await scryfallAdapter.search('dfc')
    expect(cards[0].image_url).toBe('https://img/face.jpg')
  })

  it('returns an empty result on a 404 (no matches)', async () => {
    vi.stubGlobal('fetch', mockFetch(404, { object: 'error' }))

    const result = await scryfallAdapter.search('zzzznope')
    expect(result).toEqual({ cards: [], total: 0, has_more: false })
  })

  it('throws on a non-404 upstream error', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}))
    await expect(scryfallAdapter.search('bolt')).rejects.toThrow(/Scryfall search failed: 500/)
  })
})

describe('scryfallAdapter.getById', () => {
  it('normalizes a single card lookup', async () => {
    vi.stubGlobal('fetch', mockFetch(200, sampleCard))

    const card = await scryfallAdapter.getById('abc-123')
    expect(card).toMatchObject({ id: 'abc-123', game: 'mtg', name: 'Lightning Bolt' })
    expect(card?.price.usd).toBe(1.23)
  })

  it('returns null when the card is not found', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}))
    expect(await scryfallAdapter.getById('missing')).toBeNull()
  })
})

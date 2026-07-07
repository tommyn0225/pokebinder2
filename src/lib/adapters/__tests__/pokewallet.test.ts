import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}))

import { pokewalletAdapter } from '@/lib/adapters/pokewallet'

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

// Shape-accurate PokéWallet card: nested card_info, and a tcgplayer.prices[]
// array keyed by sub_type_name (Normal / Holofoil).
const sampleCard = {
  id: 'base1-4',
  card_info: {
    name: 'Charizard',
    set_name: 'Base Set',
    set_code: 'base1',
    card_number: '4',
    card_type: 'Fire',
    rarity: 'Rare Holo',
  },
  tcgplayer: {
    prices: [
      { sub_type_name: 'Normal', market_price: 250.5 },
      { sub_type_name: 'Holofoil', market_price: 999.99 },
    ],
  },
  cardmarket: { prices: [{ avg: 210.0 }] },
}

beforeEach(() => {
  vi.stubEnv('POKEWALLET_API_KEY', 'test-key')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('pokewalletAdapter.search', () => {
  it('normalizes an upstream card, resolving Normal/Holofoil prices', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { results: [sampleCard], total: 1, has_more: false }))

    const result = await pokewalletAdapter.search('charizard')

    expect(result.total).toBe(1)
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]).toEqual({
      id: 'base1-4',
      game: 'pokemon',
      name: 'Charizard',
      set_name: 'Base Set',
      set_code: 'base1',
      collector_number: '4',
      image_url: '/api/cards/image?id=base1-4',
      type_line: 'Fire',
      rarity: 'Rare Holo',
      price: { usd: 250.5, usd_foil: 999.99, eur: 210.0 },
    })
  })

  it('falls back to the first tcgplayer price when no Normal sub-type exists', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(200, {
        results: [
          {
            ...sampleCard,
            tcgplayer: { prices: [{ sub_type_name: 'Reverse Holofoil', market_price: 42 }] },
          },
        ],
        total: 1,
      })
    )

    const { cards } = await pokewalletAdapter.search('x')
    expect(cards[0].price.usd).toBe(42)
    expect(cards[0].price.usd_foil).toBeNull()
  })

  it('unwraps a bare-array response body', async () => {
    vi.stubGlobal('fetch', mockFetch(200, [sampleCard]))

    const result = await pokewalletAdapter.search('charizard')
    expect(result.cards).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('returns an empty result on a 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}))
    expect(await pokewalletAdapter.search('nope')).toEqual({ cards: [], total: 0, has_more: false })
  })

  it('throws on a non-404 upstream error', async () => {
    vi.stubGlobal('fetch', mockFetch(429, {}))
    await expect(pokewalletAdapter.search('x')).rejects.toThrow(/PokéWallet search failed: 429/)
  })

  it('throws when the API key is not configured', async () => {
    vi.unstubAllEnvs()
    vi.stubGlobal('fetch', mockFetch(200, { results: [] }))
    await expect(pokewalletAdapter.search('x')).rejects.toThrow(/POKEWALLET_API_KEY is not set/)
  })
})

describe('pokewalletAdapter.getById', () => {
  it('normalizes a single card lookup', async () => {
    vi.stubGlobal('fetch', mockFetch(200, sampleCard))

    const card = await pokewalletAdapter.getById('base1-4')
    expect(card).toMatchObject({ id: 'base1-4', game: 'pokemon', name: 'Charizard' })
    expect(card?.price.usd).toBe(250.5)
  })

  it('returns null when the card is not found', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}))
    expect(await pokewalletAdapter.getById('missing')).toBeNull()
  })
})

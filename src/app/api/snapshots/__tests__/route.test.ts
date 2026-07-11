import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Card } from '@/types/card'

// Mock the adapters so the job never touches upstream; each test sets getById.
vi.mock('@/lib/adapters/scryfall', () => ({ scryfallAdapter: { getById: vi.fn() } }))
vi.mock('@/lib/adapters/pokewallet', () => ({ pokewalletAdapter: { getById: vi.fn() } }))
vi.mock('@/lib/adapters/optcg', () => ({ optcgAdapter: { getById: vi.fn() } }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

import { POST } from '../route'
import { scryfallAdapter } from '@/lib/adapters/scryfall'
import { createServiceClient } from '@/lib/supabase/service'

type UpdateCall = { table: string; values: Record<string, unknown>; filters: Record<string, string> }
type InsertCall = { table: string; rows: Array<Record<string, unknown>> }

// Minimal chainable fake of the Supabase query builder. select() resolves with
// the seeded holdings; update()/insert() record their calls for assertions.
function makeFakeSupabase(holdings: Array<{ id: string; card_id: string; game: string; finish?: string }>) {
  const updates: UpdateCall[] = []
  const inserts: InsertCall[] = []

  function query(table: string) {
    const state: { op?: string; values?: unknown; filters: Record<string, string> } = { filters: {} }
    const builder = {
      select() {
        return Promise.resolve({ data: table === 'holdings' ? holdings : [], error: null })
      },
      update(values: Record<string, unknown>) {
        state.op = 'update'
        state.values = values
        return builder
      },
      insert(rows: Array<Record<string, unknown>>) {
        inserts.push({ table, rows })
        return Promise.resolve({ error: null })
      },
      eq(col: string, val: string) {
        state.filters[col] = val
        return builder
      },
      then(resolve: (v: { error: null }) => unknown, reject?: (e: unknown) => unknown) {
        if (state.op === 'update') {
          updates.push({ table, values: state.values as Record<string, unknown>, filters: state.filters })
        }
        return Promise.resolve({ error: null }).then(resolve, reject)
      },
    }
    return builder
  }

  return { from: (table: string) => query(table), updates, inserts }
}

function freshCard(usd: number, usd_foil: number | null = null): Card {
  return {
    id: 'abc-123',
    game: 'mtg',
    name: 'Lightning Bolt',
    set_name: 'Magic 2010',
    set_code: 'm10',
    collector_number: '146',
    image_url: 'https://img/bolt.jpg',
    type_line: 'Instant',
    rarity: 'common',
    price: { usd, usd_foil, eur: null },
  }
}

function postRequest() {
  return new Request('http://localhost/api/snapshots', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-secret' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

beforeEach(() => {
  vi.stubEnv('SNAPSHOT_SECRET', 'test-secret')
})

describe('snapshot job', () => {
  it('refreshes holdings.card_data with the fresh price and writes a snapshot row', async () => {
    // Two holdings of the same card (different users/binders) → one unique card,
    // one card_data update covering both, and two snapshot rows.
    const holdings = [
      { id: 'h1', card_id: 'abc-123', game: 'mtg' },
      { id: 'h2', card_id: 'abc-123', game: 'mtg' },
    ]
    const fake = makeFakeSupabase(holdings)
    vi.mocked(createServiceClient).mockReturnValue(fake as never)
    vi.mocked(scryfallAdapter.getById).mockResolvedValue(freshCard(5))

    const res = await POST(postRequest())
    const body = await res.json()

    expect(body).toEqual({ inserted: 2, refreshed: 1 })

    // Exactly one card_data writeback, carrying the fresh price, keyed by
    // game + card_id (so it hits every user's copy).
    expect(fake.updates).toHaveLength(1)
    expect(fake.updates[0].table).toBe('holdings')
    expect(fake.updates[0].filters).toEqual({ game: 'mtg', card_id: 'abc-123' })
    expect((fake.updates[0].values.card_data as Card).price.usd).toBe(5)

    // Both snapshot rows carry the fresh price.
    expect(fake.inserts).toHaveLength(1)
    expect(fake.inserts[0].table).toBe('price_snapshots')
    expect(fake.inserts[0].rows.map(r => r.price_usd)).toEqual([5, 5])
  })

  it('records the foil price for a foil holding and the nonfoil price otherwise', async () => {
    // Same card held in both finishes → one card fetch, but each snapshot row
    // must carry the price matching its own finish.
    const holdings = [
      { id: 'h1', card_id: 'abc-123', game: 'mtg', finish: 'nonfoil' },
      { id: 'h2', card_id: 'abc-123', game: 'mtg', finish: 'foil' },
    ]
    const fake = makeFakeSupabase(holdings)
    vi.mocked(createServiceClient).mockReturnValue(fake as never)
    vi.mocked(scryfallAdapter.getById).mockResolvedValue(freshCard(5, 20))

    await POST(postRequest())

    expect(fake.inserts[0].rows.map(r => r.price_usd)).toEqual([5, 20])
  })

  it('skips the card_data writeback when the upstream fetch fails', async () => {
    const holdings = [{ id: 'h1', card_id: 'abc-123', game: 'mtg' }]
    const fake = makeFakeSupabase(holdings)
    vi.mocked(createServiceClient).mockReturnValue(fake as never)
    vi.mocked(scryfallAdapter.getById).mockResolvedValue(null)

    const res = await POST(postRequest())
    const body = await res.json()

    // Snapshot still recorded (with a null price), but stale card_data is left
    // untouched rather than blanked out.
    expect(body).toEqual({ inserted: 1, refreshed: 0 })
    expect(fake.updates).toHaveLength(0)
    expect(fake.inserts[0].rows[0].price_usd).toBeNull()
  })

  it('rejects an unauthorized request', async () => {
    const fake = makeFakeSupabase([])
    vi.mocked(createServiceClient).mockReturnValue(fake as never)

    const res = await POST(
      new Request('http://localhost/api/snapshots', { method: 'POST' })
    )
    expect(res.status).toBe(401)
    expect(fake.inserts).toHaveLength(0)
  })
})

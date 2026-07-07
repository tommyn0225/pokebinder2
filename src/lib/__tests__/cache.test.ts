import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Stub the Supabase (L2) client so these tests exercise ONLY the in-memory L1
// cache. L2 reads always miss (data: null) and writes are no-ops, so anything
// getCached returns must have come from the L1 map.
const upsert = vi.fn().mockResolvedValue({ error: null })
const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single }) }),
      upsert,
    }),
  }),
}))

import { getCached, setCached } from '@/lib/cache'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('L1 cache TTL', () => {
  it('returns a value from memory before its TTL elapses (no L2 read)', async () => {
    await setCached('k:fresh', { hello: 'world' }, 60)

    const value = await getCached<{ hello: string }>('k:fresh')
    expect(value).toEqual({ hello: 'world' })
    // Served from L1 — the L2 single() query should never have run.
    expect(single).not.toHaveBeenCalled()
  })

  it('expires the memory entry once the TTL has passed', async () => {
    await setCached('k:ttl', { n: 1 }, 10)

    vi.advanceTimersByTime(11_000) // 11s > 10s TTL

    const value = await getCached('k:ttl')
    expect(value).toBeNull()
    // L1 missed (expired), so it fell through to the (stubbed, empty) L2.
    expect(single).toHaveBeenCalledOnce()
  })
})

describe('L1 cache eviction', () => {
  it('evicts the oldest entry once the 500-entry cap is exceeded', async () => {
    // Fill the cache to its cap with long TTLs so nothing expires.
    for (let i = 0; i < 500; i++) {
      await setCached(`k:${i}`, i, 3600)
    }

    // The very first key is still resident and served from L1.
    expect(await getCached('k:0')).toBe(0)
    expect(single).not.toHaveBeenCalled()

    // Inserting a 501st entry evicts the oldest (k:0).
    await setCached('k:500', 500, 3600)

    const evicted = await getCached('k:0')
    expect(evicted).toBeNull()
    expect(single).toHaveBeenCalledOnce() // fell through to L2 for the evicted key

    // A newer key remains cached in L1.
    expect(await getCached('k:499')).toBe(499)
  })
})

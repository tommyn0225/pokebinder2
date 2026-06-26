import { createServiceClient } from '@/lib/supabase/service'

const DEFAULT_TTL = 60 * 60 * 24 // 24 hours

// ── L1: process-level memory cache ───────────────────────────────────────────
// Survives across requests within the same server process. Capped at 500 entries
// to avoid unbounded growth; oldest entries are evicted when the cap is hit.

const MEM_MAX = 500
interface MemEntry { value: unknown; expiresAt: number }
const memCache = new Map<string, MemEntry>()

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null }
  return entry.value as T
}

function memSet(key: string, value: unknown, ttlSeconds: number) {
  if (memCache.size >= MEM_MAX) {
    // Evict the oldest inserted key
    memCache.delete(memCache.keys().next().value!)
  }
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

// ── L2: Supabase (persistent across processes / restarts) ────────────────────

export async function getCached<T>(key: string): Promise<T | null> {
  const mem = memGet<T>(key)
  if (mem !== null) return mem

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('api_cache')
    .select('response, cached_at, ttl_seconds')
    .eq('cache_key', key)
    .single()

  if (error || !data) return null

  const ageSeconds = (Date.now() - new Date(data.cached_at).getTime()) / 1000
  if (ageSeconds > data.ttl_seconds) return null

  const remainingTtl = Math.max(1, data.ttl_seconds - ageSeconds)
  memSet(key, data.response, remainingTtl)

  return data.response as T
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds = DEFAULT_TTL
): Promise<void> {
  memSet(key, value, ttlSeconds)

  const supabase = createServiceClient()
  await supabase.from('api_cache').upsert(
    {
      cache_key: key,
      response: value,
      cached_at: new Date().toISOString(),
      ttl_seconds: ttlSeconds,
    },
    { onConflict: 'cache_key' }
  )
}

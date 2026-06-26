import { createServiceClient } from '@/lib/supabase/service'

const DEFAULT_TTL = 60 * 60 * 24 // 24 hours in seconds

export async function getCached<T>(key: string): Promise<T | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('api_cache')
    .select('response, cached_at, ttl_seconds')
    .eq('cache_key', key)
    .single()

  if (error || !data) return null

  const ageSeconds = (Date.now() - new Date(data.cached_at).getTime()) / 1000
  if (ageSeconds > data.ttl_seconds) return null

  return data.response as T
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds = DEFAULT_TTL
): Promise<void> {
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

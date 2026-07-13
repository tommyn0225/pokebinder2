-- Phase 17: per-IP rate limiting for the public v1 API. In-memory counters
-- don't survive serverless cold starts / multiple instances, so the window is
-- kept in Postgres. One tiny upsert per request; generous limits (the goal is
-- stopping a runaway scraper from burning the free-tier quota, not gatekeeping).

create table if not exists public.api_rate_limits (
  bucket text primary key,       -- e.g. 'v1:<ip>'
  hits int not null default 0,
  expires_at timestamptz not null
);

-- Service-role only: RLS on with no policies, so anon/authenticated can't read
-- or write it. The middleware hits it via the service role.
alter table public.api_rate_limits enable row level security;

-- Atomically count a hit in the current fixed window and report whether it is
-- within the limit. When the window has expired the counter resets to 1.
create or replace function public.hit_rate_limit(
  p_bucket text,
  p_limit int,
  p_window_seconds int
) returns boolean
language plpgsql
as $$
declare
  v_hits int;
begin
  insert into public.api_rate_limits (bucket, hits, expires_at)
  values (p_bucket, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket) do update
    set hits = case when public.api_rate_limits.expires_at < now() then 1
                    else public.api_rate_limits.hits + 1 end,
        expires_at = case when public.api_rate_limits.expires_at < now()
                    then now() + make_interval(secs => p_window_seconds)
                    else public.api_rate_limits.expires_at end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

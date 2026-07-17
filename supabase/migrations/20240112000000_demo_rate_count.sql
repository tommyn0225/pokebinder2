-- Phase 34 (docs API playground): a per-IP demo cap for the docs "try it"
-- widget, enforced server-side so it can't be bypassed by refreshing. Reuses
-- the api_rate_limits table from the v1 limiter (bucket 'demo:<ip>'), but the
-- widget wants to show "N pulls left", so this variant returns the current hit
-- count instead of a within-limit boolean and leaves enforcement to the caller.
create or replace function public.hit_rate_limit_count(
  p_bucket text,
  p_window_seconds int
) returns int
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
  return v_hits;
end;
$$;

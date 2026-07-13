-- Phase 17: public API hardening — SQL-side catalog dedupe + keyset pagination.
-- Previously /v1/cards loaded every holdings row into memory, deduped in JS, and
-- sliced to a limit with no cursor. This moves both the dedupe and paging into
-- the database.

-- One row per distinct (game, card_id), carrying the freshest card_data.
-- security_invoker so holdings RLS still applies to non-service callers; the v1
-- routes read it with the service role (which bypasses RLS by design).
create or replace view public.catalog_cards
with (security_invoker = true) as
select distinct on (game, card_id)
  game,
  card_id,
  card_data->>'name' as name,
  card_data
from public.holdings
order by game, card_id, created_at desc;

-- Keyset-paginated catalog page. Stable order (name, game, card_id); the caller
-- passes the last row of the previous page as the cursor. Row-value comparison
-- keeps the keyset correct even for names containing commas/quotes (which would
-- break a PostgREST filter string). Returns up to p_limit rows.
create or replace function public.catalog_page(
  p_game text default null,
  p_q text default null,
  p_after_name text default null,
  p_after_game text default null,
  p_after_card_id text default null,
  p_limit int default 50
)
returns table(game text, card_id text, name text, card_data jsonb)
language sql
stable
as $$
  select c.game, c.card_id, c.name, c.card_data
  from public.catalog_cards c
  where (p_game is null or c.game = p_game)
    and (p_q is null or c.name ilike '%' || p_q || '%')
    and (
      p_after_name is null
      or (c.name, c.game, c.card_id) > (p_after_name, p_after_game, p_after_card_id)
    )
  order by c.name, c.game, c.card_id
  limit greatest(1, least(p_limit, 101));
$$;

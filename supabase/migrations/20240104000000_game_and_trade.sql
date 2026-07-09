-- Phase "UX Improvement": one game per binder, per-card trade tags,
-- and a collection-wide value-over-time function.

-- ── binders.game ──────────────────────────────────────────────────────────────
-- Each binder is scoped to a single game. Backfill existing binders by inferring
-- the game from their holdings when they are single-game; otherwise default 'mtg'.
alter table public.binders add column if not exists game text;

update public.binders b
set game = sub.game
from (
  select binder_id, min(game) as game
  from public.holdings
  group by binder_id
  having count(distinct game) = 1
) sub
where b.id = sub.binder_id
  and b.game is null;

update public.binders set game = 'mtg' where game is null;

alter table public.binders alter column game set default 'mtg';
alter table public.binders alter column game set not null;

alter table public.binders drop constraint if exists binders_game_check;
alter table public.binders
  add constraint binders_game_check check (game in ('mtg', 'pokemon', 'onepiece'));

-- ── holdings.for_trade ────────────────────────────────────────────────────────
-- Marks a whole holding (card stack) as available for trade.
alter table public.holdings
  add column if not exists for_trade boolean not null default false;

-- ── collection_value_history ──────────────────────────────────────────────────
-- Daily total value across ALL of a user's holdings, mirroring
-- binder_value_history but scoped to a user instead of a single binder.
create or replace function public.collection_value_history(user_id_param uuid)
returns table(day timestamp with time zone, total_usd numeric)
language sql stable
as $$
  select
    date_trunc('day', ps.snapshotted_at) as day,
    sum(ps.price_usd * h.quantity)       as total_usd
  from price_snapshots ps
  join holdings h on ps.holding_id = h.id
  where h.user_id = user_id_param
    and ps.price_usd is not null
  group by date_trunc('day', ps.snapshotted_at)
  order by day;
$$;

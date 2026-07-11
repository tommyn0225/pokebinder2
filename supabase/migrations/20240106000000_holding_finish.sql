-- Phase 14: per-holding finish (foil vs nonfoil).
-- A card's foil and nonfoil printings carry different market prices
-- (card_data.price.usd vs usd_foil), so a holding must record which one it is
-- for valuation to be correct.

alter table public.holdings
  add column if not exists finish text not null default 'nonfoil';

alter table public.holdings drop constraint if exists holdings_finish_check;
alter table public.holdings
  add constraint holdings_finish_check check (finish in ('nonfoil', 'foil'));

-- The same card in foil vs nonfoil is two separate stacks, so the uniqueness
-- key gains finish. Existing rows backfill to 'nonfoil' via the default and
-- stay unique because today there is at most one row per (binder_id, card_id).
alter table public.holdings drop constraint if exists holdings_binder_id_card_id_key;
alter table public.holdings
  add constraint holdings_binder_id_card_id_finish_key unique (binder_id, card_id, finish);

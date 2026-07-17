-- Phase 30: a for-trade list only exists to be shared, so it is always public.
-- Drop the public/private gate entirely — the share token always resolves.
alter table public.trade_lists drop column if exists is_public;

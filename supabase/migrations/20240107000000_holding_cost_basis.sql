-- Phase 15: cost basis & gain/loss.
-- Record what the user paid per copy so we can show gain/loss against the
-- current market value. A null acquired_price_usd means "cost unknown" — such
-- holdings are excluded from cost basis rather than counted as $0.

alter table public.holdings
  add column if not exists acquired_price_usd numeric null;

alter table public.holdings
  add column if not exists acquired_at date not null default current_date;

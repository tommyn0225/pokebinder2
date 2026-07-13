-- Phase 18: per-card price history endpoint.
-- The public /v1/cards/{game}/{id}/history endpoint filters snapshots by
-- (game, card_id) over a time window; index that access path.
create index if not exists price_snapshots_game_card_snapshotted_idx
  on public.price_snapshots (game, card_id, snapshotted_at);

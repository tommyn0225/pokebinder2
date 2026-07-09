-- Shareable per-user trade list: a public, tokenized view of the cards a user
-- has marked "for trade" across all their binders.

create table if not exists public.trade_lists (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  is_public boolean not null default false,
  created_at timestamp with time zone default now()
);

alter table public.trade_lists enable row level security;

drop policy if exists "Users manage own trade list" on public.trade_lists;
create policy "Users manage own trade list" on public.trade_lists
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { scryfallAdapter } from '@/lib/adapters/scryfall'
import { pokewalletAdapter } from '@/lib/adapters/pokewallet'
import { optcgAdapter } from '@/lib/adapters/optcg'
import type { Card, GameAdapter } from '@/types/card'

const ADAPTERS: Record<string, GameAdapter> = {
  mtg: scryfallAdapter,
  pokemon: pokewalletAdapter,
  onepiece: optcgAdapter,
}

export async function POST(request: Request) {
  const secret = process.env.SNAPSHOT_SECRET
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Fetch all holdings across all users
  const { data: holdings, error } = await supabase
    .from('holdings')
    .select('id, card_id, game')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ inserted: 0 })
  }

  // Deduplicate by game+card_id to minimize API calls
  type HoldingRow = { id: string; card_id: string; game: string }
  const unique = new Map<string, { card_id: string; game: string }>()
  for (const h of holdings as HoldingRow[]) {
    unique.set(`${h.game}:${h.card_id}`, { card_id: h.card_id, game: h.game })
  }

  // Fetch the current normalized card for each unique card
  const cardMap = new Map<string, Card | null>()
  await Promise.allSettled(
    Array.from(unique.values()).map(async ({ card_id, game }) => {
      const adapter = ADAPTERS[game]
      if (!adapter) return
      const card = await adapter.getById(card_id)
      cardMap.set(`${game}:${card_id}`, card)
    })
  )

  // Refresh holdings.card_data with the freshest normalized card. Valuation,
  // the v1 catalog, and share pages all read card_data, so without this the
  // headline "current value" stays frozen at the price the card had when it
  // was first added while only the trend chart moves. One update per unique
  // card covers every user's holding of it (card_data is user-independent).
  // Skip cards whose fetch failed so a flaky upstream never blanks out data.
  const refreshes = Array.from(unique.values())
    .map(({ card_id, game }) => ({ card_id, game, card: cardMap.get(`${game}:${card_id}`) }))
    .filter((r): r is { card_id: string; game: string; card: Card } => Boolean(r.card))

  await Promise.allSettled(
    refreshes.map(({ card_id, game, card }) =>
      supabase.from('holdings').update({ card_data: card }).eq('game', game).eq('card_id', card_id)
    )
  )

  // Build snapshot rows
  const now = new Date().toISOString()
  const rows = (holdings as HoldingRow[]).map(h => ({
    holding_id: h.id,
    card_id: h.card_id,
    game: h.game,
    price_usd: cardMap.get(`${h.game}:${h.card_id}`)?.price.usd ?? null,
    snapshotted_at: now,
  }))

  const { error: insertError } = await supabase.from('price_snapshots').insert(rows)
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ inserted: rows.length, refreshed: refreshes.length })
}

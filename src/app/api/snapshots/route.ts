import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scryfallAdapter } from '@/lib/adapters/scryfall'
import { pokewalletAdapter } from '@/lib/adapters/pokewallet'
import { optcgAdapter } from '@/lib/adapters/optcg'
import type { GameAdapter } from '@/types/card'

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

  const supabase = await createClient()

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

  // Fetch current prices for each unique card
  const priceMap = new Map<string, number | null>()
  await Promise.allSettled(
    Array.from(unique.values()).map(async ({ card_id, game }) => {
      const adapter = ADAPTERS[game]
      if (!adapter) return
      const card = await adapter.getById(card_id)
      priceMap.set(`${game}:${card_id}`, card?.price.usd ?? null)
    })
  )

  // Build snapshot rows
  const now = new Date().toISOString()
  const rows = (holdings as HoldingRow[]).map(h => ({
    holding_id: h.id,
    card_id: h.card_id,
    game: h.game,
    price_usd: priceMap.get(`${h.game}:${h.card_id}`) ?? null,
    snapshotted_at: now,
  }))

  const { error: insertError } = await supabase.from('price_snapshots').insert(rows)
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ inserted: rows.length })
}

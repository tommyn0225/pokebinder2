import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ATTRIBUTION, V1_HEADERS, isGame, serializeCard } from '@/lib/publicApi'
import type { Card } from '@/types/card'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: V1_HEADERS })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const game = url.searchParams.get('game')
  const q = url.searchParams.get('q')
  const limitParam = Number(url.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
    : 50

  if (game && !isGame(game)) {
    return NextResponse.json(
      { error: 'Unknown game; expected mtg, pokemon, or onepiece' },
      { status: 400, headers: V1_HEADERS }
    )
  }

  // The catalog is every distinct card tracked in Binder, served from our own
  // normalized card_data — not a live upstream search (see CLAUDE.md
  // "Respect upstream terms"). Holdings are private per-user; only the
  // normalized card itself crosses this boundary, never who holds it.
  const supabase = createServiceClient()
  let query = supabase.from('holdings').select('card_id, game, card_data')
  if (game) query = query.eq('game', game)
  if (q) query = query.ilike('card_data->>name', `%${q}%`)
  const { data } = await query

  const seen = new Set<string>()
  const cards = []
  for (const row of (data ?? []) as { card_id: string; game: string; card_data: Card }[]) {
    const key = `${row.game}:${row.card_id}`
    if (seen.has(key)) continue
    seen.add(key)
    cards.push(serializeCard(row.card_data))
  }
  cards.sort((a, b) => a.name.localeCompare(b.name))
  const limited = cards.slice(0, limit)

  return NextResponse.json(
    { count: limited.length, cards: limited, attribution: ATTRIBUTION },
    { headers: V1_HEADERS }
  )
}

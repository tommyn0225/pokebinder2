import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ATTRIBUTION, V1_HEADERS, isGame, serializeCard, v1Error, v1Json, v1Origin } from '@/lib/publicApi'
import type { Card } from '@/types/card'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: V1_HEADERS })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ game: string; id: string }> }
) {
  const { game, id } = await params

  const notFound = v1Error(404, 'not_found', 'Card not found in catalog')
  if (!isGame(game)) return notFound

  const supabase = createServiceClient()
  const { data: holding } = await supabase
    .from('holdings')
    .select('card_data')
    .eq('game', game)
    .eq('card_id', id)
    .limit(1)
    .maybeSingle()

  if (!holding) return notFound

  const { data: snapshots } = await supabase
    .from('price_snapshots')
    .select('price_usd, snapshotted_at')
    .eq('game', game)
    .eq('card_id', id)
    .not('price_usd', 'is', null)
    .order('snapshotted_at', { ascending: true })

  // The same card held in several binders snapshots the same price, so keep
  // one point per day.
  const byDay = new Map<string, number>()
  for (const s of (snapshots ?? []) as { price_usd: number; snapshotted_at: string }[]) {
    const day = s.snapshotted_at.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, Number(s.price_usd))
  }
  const history = [...byDay.entries()].map(([day, price_usd]) => ({ day, price_usd }))

  return v1Json(request, {
    card: serializeCard(holding.card_data as Card, v1Origin(request)),
    history,
    attribution: ATTRIBUTION,
  })
}

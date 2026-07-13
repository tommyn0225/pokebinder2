import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ATTRIBUTION, V1_HEADERS, isGame, v1Error, v1Json } from '@/lib/publicApi'
import { logError } from '@/lib/logError'

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

  const url = new URL(request.url)
  const daysParam = Number(url.searchParams.get('days') ?? '30')
  const days = Number.isFinite(daysParam)
    ? Math.min(Math.max(Math.trunc(daysParam), 1), 365)
    : 30

  const supabase = createServiceClient()

  // Only serve cards that are actually in the catalog (tracked by a holding).
  const { data: holding } = await supabase
    .from('holdings')
    .select('card_id')
    .eq('game', game)
    .eq('card_id', id)
    .limit(1)
    .maybeSingle()
  if (!holding) return notFound

  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('price_snapshots')
    .select('price_usd, snapshotted_at')
    .eq('game', game)
    .eq('card_id', id)
    .not('price_usd', 'is', null)
    .gte('snapshotted_at', since)
    .order('snapshotted_at', { ascending: true })

  if (error) {
    logError('v1:card-history', error)
    return v1Error(500, 'internal', 'Failed to load history')
  }

  // Snapshots are per holding (the same card in several binders snapshots the
  // same price), so collapse to one point per day.
  const byDay = new Map<string, number>()
  for (const s of (data ?? []) as { price_usd: number; snapshotted_at: string }[]) {
    const day = s.snapshotted_at.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, Number(s.price_usd))
  }
  const history = [...byDay.entries()].map(([day, price_usd]) => ({ day, price_usd }))

  return v1Json(request, {
    game,
    card_id: id,
    days,
    history,
    attribution: ATTRIBUTION,
  })
}

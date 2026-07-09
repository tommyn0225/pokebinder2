import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ATTRIBUTION, V1_HEADERS, serializeHolding } from '@/lib/publicApi'
import type { Card } from '@/types/card'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: V1_HEADERS })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Binders/holdings are owner-only under RLS; a public endpoint reads past RLS
  // with the service role and gates on is_public itself.
  const supabase = createServiceClient()
  const { data: binder } = await supabase
    .from('binders')
    .select('id, name, game, is_public')
    .eq('id', id)
    .maybeSingle()

  if (!binder || !binder.is_public) {
    return NextResponse.json(
      { error: 'Binder not found or not public' },
      { status: 404, headers: V1_HEADERS }
    )
  }

  const { data: holdings } = await supabase
    .from('holdings')
    .select('quantity, for_trade, card_data')
    .eq('binder_id', id)
    .order('created_at', { ascending: true })

  const list = (holdings ?? []) as { quantity: number; for_trade: boolean; card_data: Card }[]
  let total_usd = 0
  let card_count = 0
  for (const h of list) {
    total_usd += (h.card_data.price.usd ?? 0) * h.quantity
    card_count += h.quantity
  }

  return NextResponse.json(
    {
      binder: { id: binder.id, name: binder.name, game: binder.game },
      card_count,
      total_usd: Math.round(total_usd * 100) / 100,
      holdings: list.map(h => serializeHolding(h, { includeForTrade: true })),
      attribution: ATTRIBUTION,
    },
    { headers: V1_HEADERS }
  )
}

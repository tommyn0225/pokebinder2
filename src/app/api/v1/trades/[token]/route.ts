import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ATTRIBUTION, V1_HEADERS, serializeHolding } from '@/lib/publicApi'
import type { Card } from '@/types/card'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: V1_HEADERS })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const supabase = createServiceClient()
  const { data: tradeList } = await supabase
    .from('trade_lists')
    .select('user_id, is_public')
    .eq('token', token)
    .maybeSingle()

  if (!tradeList || !tradeList.is_public) {
    return NextResponse.json(
      { error: 'Trade list not found or not public' },
      { status: 404, headers: V1_HEADERS }
    )
  }

  const { data: holdings } = await supabase
    .from('holdings')
    .select('quantity, card_data')
    .eq('user_id', tradeList.user_id)
    .eq('for_trade', true)
    .order('created_at', { ascending: true })

  const list = (holdings ?? []) as { quantity: number; card_data: Card }[]
  const total_cards = list.reduce((n, h) => n + h.quantity, 0)

  return NextResponse.json(
    {
      total_cards,
      cards: list.map(h => serializeHolding(h)),
      attribution: ATTRIBUTION,
    },
    { headers: V1_HEADERS }
  )
}

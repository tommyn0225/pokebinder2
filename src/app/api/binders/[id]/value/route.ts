import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { holdingUnitPrice, summarizeGain } from '@/lib/holdingValue'
import { logError } from '@/lib/logError'
import type { Holding } from '@/types/holding'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: binder } = await supabase
    .from('binders')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!binder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('holdings')
    .select('quantity, finish, acquired_price_usd, card_data')
    .eq('binder_id', id)

  if (error) {
    logError('binder:value', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }

  const holdings = (data ?? []) as Pick<Holding, 'quantity' | 'finish' | 'acquired_price_usd' | 'card_data'>[]
  const total_usd = holdings.reduce((sum, h) => sum + holdingUnitPrice(h) * h.quantity, 0)

  return NextResponse.json({
    total_usd: Math.round(total_usd * 100) / 100,
    ...summarizeGain(holdings),
  })
}

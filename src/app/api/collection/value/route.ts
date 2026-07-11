import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { holdingUnitPrice, summarizeGain } from '@/lib/holdingValue'
import { logError } from '@/lib/logError'
import type { Holding } from '@/types/holding'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: binders, error: bindersError } = await supabase
    .from('binders')
    .select('id, name')
    .eq('user_id', user.id)

  if (bindersError) {
    logError('collection:value:binders', bindersError)
    return NextResponse.json({ error: bindersError.message }, { status: 500 })
  }

  const { data, error: holdingsError } = await supabase
    .from('holdings')
    .select('binder_id, quantity, finish, acquired_price_usd, card_data')
    .eq('user_id', user.id)

  if (holdingsError) {
    logError('collection:value:holdings', holdingsError)
    return NextResponse.json({ error: holdingsError.message }, { status: 500 })
  }

  const holdings = (data ?? []) as Pick<Holding, 'binder_id' | 'quantity' | 'finish' | 'acquired_price_usd' | 'card_data'>[]
  const byBinder = new Map<string, number>()
  let total_usd = 0

  for (const h of holdings) {
    const value = holdingUnitPrice(h) * h.quantity
    byBinder.set(h.binder_id, (byBinder.get(h.binder_id) ?? 0) + value)
    total_usd += value
  }

  const by_binder = (binders ?? []).map(b => ({
    binder_id: b.id,
    name: b.name,
    total_usd: Math.round((byBinder.get(b.id) ?? 0) * 100) / 100,
  }))

  return NextResponse.json({
    total_usd: Math.round(total_usd * 100) / 100,
    by_binder,
    ...summarizeGain(holdings),
  })
}

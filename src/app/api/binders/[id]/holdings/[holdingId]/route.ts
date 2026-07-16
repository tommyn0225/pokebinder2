import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logError'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; holdingId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { holdingId } = await params
  const body = await request.json()

  const update: Record<string, unknown> = {}
  if (body.quantity !== undefined) {
    update.quantity = Math.max(1, Math.floor(Number(body.quantity) || 1))
  }
  if (typeof body.for_trade === 'boolean') {
    update.for_trade = body.for_trade
  }
  // Cost basis: accept a non-negative number, or null to clear it back to
  // "cost unknown" (which excludes the holding from cost basis).
  if (body.acquired_price_usd !== undefined) {
    if (body.acquired_price_usd === null) {
      update.acquired_price_usd = null
    } else {
      const n = Number(body.acquired_price_usd)
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: 'acquired_price_usd must be a non-negative number' }, { status: 400 })
      }
      update.acquired_price_usd = n
    }
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('holdings')
    .update(update)
    .eq('id', holdingId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    logError('holdings:update', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; holdingId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { holdingId } = await params

  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('id', holdingId)
    .eq('user_id', user.id)

  if (error) {
    logError('holdings:delete', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}

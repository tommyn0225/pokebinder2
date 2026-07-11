import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Card } from '@/types/card'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify the binder belongs to this user
  const { data: binder } = await supabase
    .from('binders')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!binder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('holdings')
    .select('id, binder_id, user_id, card_id, game, quantity, finish, for_trade, card_data, created_at')
    .eq('binder_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
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

  const body = await request.json()
  const { card_id, game, quantity, card_data, finish: finishRaw } = body as {
    card_id: string
    game: string
    quantity: number
    card_data: Card
    finish?: string
  }

  if (!card_id || !game || !card_data) {
    return NextResponse.json({ error: 'card_id, game, and card_data are required' }, { status: 400 })
  }

  if (finishRaw !== undefined && finishRaw !== 'nonfoil' && finishRaw !== 'foil') {
    return NextResponse.json({ error: 'finish must be nonfoil or foil' }, { status: 400 })
  }
  const finish = finishRaw === 'foil' ? 'foil' : 'nonfoil'

  const qty = Math.max(1, Math.floor(Number(quantity) || 1))

  // Upsert: the same card in a different finish is a separate stack, so an
  // existing row is matched on card_id + finish, not card_id alone.
  const { data: existing } = await supabase
    .from('holdings')
    .select('id, quantity')
    .eq('binder_id', id)
    .eq('card_id', card_id)
    .eq('finish', finish)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from('holdings')
      .update({ quantity: existing.quantity + qty, card_data })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('holdings')
    .insert({ binder_id: id, user_id: user.id, card_id, game, quantity: qty, finish, card_data })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_GAMES = ['mtg', 'pokemon', 'onepiece'] as const
const MAX_BINDERS = 3

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('binders')
    .select('id, name, game, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  // Game defaults to 'mtg' when omitted so existing clients keep working;
  // the create UI (sub-phase B) sends an explicit choice.
  const game = body.game === undefined ? 'mtg' : body.game
  if (!VALID_GAMES.includes(game)) {
    return NextResponse.json({ error: 'Invalid game. Use mtg, pokemon, or onepiece.' }, { status: 400 })
  }

  // Enforce the per-user binder cap.
  const { count, error: countError } = await supabase
    .from('binders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
  if ((count ?? 0) >= MAX_BINDERS) {
    return NextResponse.json({ error: `You can have at most ${MAX_BINDERS} binders.` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('binders')
    .insert({ user_id: user.id, name, game })
    .select('id, name, game, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

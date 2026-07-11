import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logError'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (typeof body.is_public !== 'boolean') {
    return NextResponse.json({ error: 'is_public (boolean) is required' }, { status: 400 })
  }

  // Upsert keeps the existing token (only set on insert) while flipping visibility.
  const { data, error } = await supabase
    .from('trade_lists')
    .upsert({ user_id: user.id, is_public: body.is_public }, { onConflict: 'user_id' })
    .select('token, is_public')
    .single()

  if (error) {
    logError('trades:share', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

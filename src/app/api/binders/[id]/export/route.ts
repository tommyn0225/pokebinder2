import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { holdingsToDeckList } from '@/lib/mtgDeckList'
import { logError } from '@/lib/logError'
import type { Holding } from '@/types/holding'

// Turn a binder name into a safe filename ("My Deck!" -> "my-deck").
function safeFilename(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'binder'}.txt`
}

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
    .select('id, name, game')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!binder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Deck-list export is an MTG-community convention; only MTG binders offer it.
  if (binder.game !== 'mtg') {
    return NextResponse.json(
      { error: 'Deck-list export is only available for Magic binders.' },
      { status: 400 }
    )
  }

  const { data: holdings, error } = await supabase
    .from('holdings')
    .select('quantity, finish, card_data')
    .eq('binder_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    logError('binders/export', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }

  const text = holdingsToDeckList((holdings ?? []) as Holding[])
  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFilename(binder.name)}"`,
    },
  })
}

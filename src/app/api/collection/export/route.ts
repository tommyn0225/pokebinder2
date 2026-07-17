import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { holdingsToCsv } from '@/lib/holdingsExport'
import { logError } from '@/lib/logError'
import type { Holding } from '@/types/holding'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Every holding the user owns, across all binders. RLS also scopes to the
  // user, but filter explicitly so the intent is on the query.
  const { data: holdings, error } = await supabase
    .from('holdings')
    .select('quantity, finish, card_data')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    logError('collection/export', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }

  const csv = holdingsToCsv((holdings ?? []) as Holding[])
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="collection.csv"',
    },
  })
}

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ATTRIBUTION, V1_HEADERS } from '@/lib/publicApi'
import { logError } from '@/lib/logError'

interface HistoryPoint {
  day: string
  total_usd: number
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: V1_HEADERS })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createServiceClient()
  const { data: binder } = await supabase
    .from('binders')
    .select('id, is_public')
    .eq('id', id)
    .maybeSingle()

  if (!binder || !binder.is_public) {
    return NextResponse.json(
      { error: 'Binder not found or not public' },
      { status: 404, headers: V1_HEADERS }
    )
  }

  // Our own price history, built from daily snapshots — not upstream history.
  const { data, error } = await supabase.rpc('binder_value_history', { binder_id_param: id })
  if (error) {
    logError('v1:binder-history', error)
    return NextResponse.json({ error: error.message }, { status: 500, headers: V1_HEADERS })
  }

  return NextResponse.json(
    {
      binder_id: id,
      history: (data ?? []) as HistoryPoint[],
      attribution: ATTRIBUTION,
    },
    { headers: V1_HEADERS }
  )
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logError } from '@/lib/logError'
import type { ValueHistoryPoint } from '@/components/ValueChart'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // price_snapshots has RLS enabled with no policies (service-role only), and
  // collection_value_history is SECURITY INVOKER, so this must run as the
  // service role. It is scoped to the authenticated user's own holdings.
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.rpc('collection_value_history', { user_id_param: user.id })

  if (error) {
    logError('snapshots:collection', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }

  return NextResponse.json({ history: data as ValueHistoryPoint[] })
}

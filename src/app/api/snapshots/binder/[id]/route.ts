import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export interface BinderHistoryPoint {
  day: string
  total_usd: number
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify binder belongs to user
  const { data: binder } = await supabase
    .from('binders')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!binder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get daily binder value: sum(price_usd * current quantity) per day
  // Using current quantity as the best approximation (quantity history not tracked)
  // price_snapshots has RLS enabled with no policies (service-role only), and
  // binder_value_history is SECURITY INVOKER, so this must run as the service role.
  // Ownership of the binder was already verified above with the user-scoped client.
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.rpc('binder_value_history', { binder_id_param: id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ history: data as BinderHistoryPoint[] })
}

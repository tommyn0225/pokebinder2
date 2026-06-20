import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.rpc('pg_sleep', { seconds: 0 }).single()

    // "function does not exist" still means the DB responded
    const dbReachable = !error || error.code === 'PGRST202' || error.code === '42883'

    if (!dbReachable) throw new Error(error!.message)

    return NextResponse.json({ ok: true, db: true })
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: false, error: String(err) },
      { status: 500 }
    )
  }
}

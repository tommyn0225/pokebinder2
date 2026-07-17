import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ATTRIBUTION, isGame, serializeCard, v1Origin } from '@/lib/publicApi'
import { logError } from '@/lib/logError'
import type { Card } from '@/types/card'

// Backing endpoint for the docs "API playground" widget. It pulls real card
// info from the normalized catalog (same source as GET /api/v1/cards), but is
// capped hard so a public docs page can't become an uncapped API: N pulls per
// IP per day, counted in Postgres (see the hit_rate_limit_count migration).
// It lives outside /api/v1 on purpose — this is a demo affordance, not part of
// the stable, documented public contract.
const DEMO_LIMIT = 3
const DEMO_WINDOW_SECONDS = 60 * 60 * 24 // one day
const DEMO_RESULT_LIMIT = 12

// Never cache: the response carries a per-request "pulls remaining" count.
const DEMO_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  // Wildcard is valid here because the endpoint never uses credentials; keeps
  // the docs "Try it" button from tripping a preflight over a stray header.
  'Access-Control-Allow-Headers': '*',
  'Cache-Control': 'no-store',
}

function clientIp(request: Request): string {
  const h = request.headers
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  )
}

function demoError(
  status: number,
  code: string,
  message: string,
  remaining: number,
  extraHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    { error: { code, message }, demo: { limit: DEMO_LIMIT, remaining } },
    { status, headers: { ...DEMO_HEADERS, ...(extraHeaders ?? {}) } }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: DEMO_HEADERS })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const game = url.searchParams.get('game')
  const q = url.searchParams.get('q')

  if (game && !isGame(game)) {
    return demoError(400, 'invalid_request', 'Unknown game; expected mtg, pokemon, or onepiece', DEMO_LIMIT)
  }

  const supabase = createServiceClient()

  // Count this pull first, then enforce. Fail open (like the v1 limiter) if the
  // counter is unreachable — a limiter hiccup shouldn't break the demo.
  let remaining = DEMO_LIMIT
  const { data: hits, error: limitErr } = await supabase.rpc('hit_rate_limit_count', {
    p_bucket: `demo:${clientIp(request)}`,
    p_window_seconds: DEMO_WINDOW_SECONDS,
  })
  if (limitErr) {
    logError('demo:cards:limit', limitErr)
  } else if (typeof hits === 'number') {
    remaining = Math.max(0, DEMO_LIMIT - hits)
    if (hits > DEMO_LIMIT) {
      return demoError(
        429,
        'rate_limited',
        `Demo limit reached — ${DEMO_LIMIT} card pulls per day from one address. ` +
          'Run Binder locally and call /api/v1/cards directly for unlimited access.',
        0,
        { 'Retry-After': String(DEMO_WINDOW_SECONDS) }
      )
    }
  }

  const { data, error } = await supabase.rpc('catalog_page', {
    p_game: game ?? null,
    p_q: q ?? null,
    p_after_name: null,
    p_after_game: null,
    p_after_card_id: null,
    p_limit: DEMO_RESULT_LIMIT,
  })
  if (error) {
    logError('demo:cards', error)
    return demoError(500, 'internal', 'Failed to load catalog', remaining)
  }

  const rows = (data ?? []) as { card_data: Card }[]
  return NextResponse.json(
    {
      count: rows.length,
      demo: { limit: DEMO_LIMIT, remaining },
      cards: rows.map((r) => serializeCard(r.card_data, v1Origin(request))),
      attribution: ATTRIBUTION,
    },
    { headers: DEMO_HEADERS }
  )
}

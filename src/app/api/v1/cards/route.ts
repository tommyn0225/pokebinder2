import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ATTRIBUTION, V1_HEADERS, isGame, serializeCard, v1Error, v1Json, v1Origin } from '@/lib/publicApi'
import { logError } from '@/lib/logError'
import type { Card } from '@/types/card'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: V1_HEADERS })
}

// The cursor is an opaque base64url token; internally it's the last row's
// (name, game, card_id), which is exactly the keyset the SQL page orders by.
interface Cursor { n: string; g: string; c: string }

function encodeCursor(cur: Cursor): string {
  return Buffer.from(JSON.stringify(cur), 'utf8').toString('base64url')
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const cur = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (cur && typeof cur.n === 'string' && typeof cur.g === 'string' && typeof cur.c === 'string') return cur
  } catch {
    // fall through
  }
  return null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const game = url.searchParams.get('game')
  const q = url.searchParams.get('q')
  const cursorParam = url.searchParams.get('cursor')
  const limitParam = Number(url.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
    : 50

  if (game && !isGame(game)) {
    return v1Error(400, 'invalid_request', 'Unknown game; expected mtg, pokemon, or onepiece')
  }

  let after: Cursor | null = null
  if (cursorParam) {
    after = decodeCursor(cursorParam)
    if (!after) return v1Error(400, 'invalid_request', 'Invalid cursor')
  }

  // The catalog is every distinct card tracked in Binder, deduped and paged in
  // SQL (see the catalog_cards view). Holdings are private per-user; only the
  // normalized card itself crosses this boundary, never who holds it.
  const supabase = createServiceClient()
  // Fetch one extra row to learn whether another page exists.
  const { data, error } = await supabase.rpc('catalog_page', {
    p_game: game ?? null,
    p_q: q ?? null,
    p_after_name: after?.n ?? null,
    p_after_game: after?.g ?? null,
    p_after_card_id: after?.c ?? null,
    p_limit: limit + 1,
  })

  if (error) {
    logError('v1:cards', error)
    return v1Error(500, 'internal', 'Failed to load catalog')
  }

  const rows = (data ?? []) as { game: string; card_id: string; name: string; card_data: Card }[]
  const has_more = rows.length > limit
  const page = has_more ? rows.slice(0, limit) : rows
  const last = page[page.length - 1]
  const next_cursor = has_more && last
    ? encodeCursor({ n: last.name, g: last.game, c: last.card_id })
    : null

  return v1Json(request, {
    // `count` is the number of items in THIS page, not the catalog total.
    count: page.length,
    has_more,
    next_cursor,
    cards: page.map(r => serializeCard(r.card_data, v1Origin(request))),
    attribution: ATTRIBUTION,
  })
}

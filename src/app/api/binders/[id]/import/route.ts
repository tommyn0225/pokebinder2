import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scryfallAdapter } from '@/lib/adapters/scryfall'
import { parseDeckList, type DeckListRow } from '@/lib/mtgDeckList'
import { finishPrice } from '@/lib/holdingValue'
import { logError } from '@/lib/logError'
import type { Card } from '@/types/card'
import type { Finish } from '@/types/holding'

// Cap per import so a pasted mega-list can't fan out into hundreds of upstream
// lookups in one request. Scryfall is generous, but the cache + this bound keep
// a single import well-behaved.
const MAX_ROWS = 500

interface MatchedRow {
  raw: string
  quantity: number
  finish: Finish
  card: Card
}

interface UnmatchedRow {
  raw: string
  name: string
  reason: string
}

// Resolve every parsed row against Scryfall, splitting into matched/unmatched.
// Sequential on purpose: results are cached, and it keeps us gentle on upstream.
async function resolveRows(rows: DeckListRow[]) {
  const matched: MatchedRow[] = []
  const unmatched: UnmatchedRow[] = []
  for (const row of rows) {
    let card: Card | null = null
    try {
      card = await scryfallAdapter.resolveByName(row.name, row.setCode ?? undefined)
    } catch (err) {
      logError('binders/import:resolve', err)
      unmatched.push({ raw: row.raw, name: row.name, reason: 'Lookup failed' })
      continue
    }
    if (!card) {
      unmatched.push({ raw: row.raw, name: row.name, reason: 'No matching card found' })
      continue
    }
    matched.push({ raw: row.raw, quantity: row.quantity, finish: row.finish, card })
  }
  return { matched, unmatched }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: binder } = await supabase
    .from('binders')
    .select('id, game')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!binder) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (binder.game !== 'mtg') {
    return NextResponse.json(
      { error: 'Deck-list import is only available for Magic binders.' },
      { status: 400 }
    )
  }

  const body = await request.json().catch(() => null)
  const text = typeof body?.text === 'string' ? body.text : ''
  const dryRun = body?.dryRun !== false // preview unless explicitly committing
  if (!text.trim()) {
    return NextResponse.json({ error: 'Paste a deck list to import.' }, { status: 400 })
  }

  const { rows, errors } = parseDeckList(text)
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many lines (${rows.length}). Import up to ${MAX_ROWS} at a time.` },
      { status: 400 }
    )
  }

  const { matched, unmatched } = await resolveRows(rows)
  // Lines that couldn't be parsed join the unmatched list so the preview is
  // one complete picture of what won't import.
  for (const e of errors) unmatched.push({ raw: e.raw, name: e.raw, reason: e.reason })

  // Preview shape: strip card_data down to what the UI shows.
  const preview = {
    matched: matched.map((m) => ({
      raw: m.raw,
      quantity: m.quantity,
      finish: m.finish,
      name: m.card.name,
      set_code: m.card.set_code,
      collector_number: m.card.collector_number,
      image_url: m.card.image_url,
      price: m.card.price,
    })),
    unmatched,
  }

  if (dryRun) {
    return NextResponse.json(preview)
  }

  // Commit: upsert each matched row. Same identity as the holdings POST route —
  // a stack is (binder_id, card_id, finish); an existing stack increments.
  let imported = 0
  for (const m of matched) {
    const { data: existing } = await supabase
      .from('holdings')
      .select('id, quantity')
      .eq('binder_id', id)
      .eq('card_id', m.card.id)
      .eq('finish', m.finish)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('holdings')
        .update({ quantity: existing.quantity + m.quantity, card_data: m.card })
        .eq('id', existing.id)
      if (error) {
        logError('binders/import:increment', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
      }
    } else {
      const { error } = await supabase.from('holdings').insert({
        binder_id: id,
        user_id: user.id,
        card_id: m.card.id,
        game: 'mtg',
        quantity: m.quantity,
        finish: m.finish,
        acquired_price_usd: finishPrice(m.finish, m.card.price),
        card_data: m.card,
      })
      if (error) {
        logError('binders/import:insert', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
      }
    }
    imported += m.quantity
  }

  return NextResponse.json({ imported, stacks: matched.length, unmatched: preview.unmatched })
}

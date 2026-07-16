import { NextRequest, NextResponse } from 'next/server'
import { scryfallAdapter } from '@/lib/adapters/scryfall'
import { pokewalletAdapter } from '@/lib/adapters/pokewallet'
import { optcgAdapter } from '@/lib/adapters/optcg'
import { logError } from '@/lib/logError'
import type { GameAdapter } from '@/types/card'

const adapters: Record<string, GameAdapter> = {
  mtg: scryfallAdapter,
  pokemon: pokewalletAdapter,
  onepiece: optcgAdapter,
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const name = params.get('name')?.trim() ?? ''
  const game = params.get('game') ?? 'mtg'

  if (name.length < 2) {
    return NextResponse.json({ error: 'Provide a card name (at least 2 characters).' }, { status: 400 })
  }

  const adapter = adapters[game]
  if (!adapter) {
    return NextResponse.json({ error: 'Unknown game. Use mtg, pokemon, or onepiece.' }, { status: 400 })
  }
  if (!adapter.getPrintings) {
    return NextResponse.json({ error: `Printing selection is not supported for ${game}.` }, { status: 400 })
  }

  try {
    const cards = await adapter.getPrintings(name)
    return NextResponse.json(cards, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    })
  } catch (err) {
    logError(`cards/printings:${game}`, err)
    return NextResponse.json({ error: 'Failed to load printings. Please try again.' }, { status: 500 })
  }
}

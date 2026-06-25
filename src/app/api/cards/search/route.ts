import { NextRequest, NextResponse } from 'next/server'
import { scryfallAdapter } from '@/lib/adapters/scryfall'
import { pokewalletAdapter } from '@/lib/adapters/pokewallet'
import { optcgAdapter } from '@/lib/adapters/optcg'
import type { GameAdapter } from '@/types/card'

const adapters: Record<string, GameAdapter> = {
  mtg: scryfallAdapter,
  pokemon: pokewalletAdapter,
  onepiece: optcgAdapter,
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const game = req.nextUrl.searchParams.get('game') ?? 'mtg'

  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters.' }, { status: 400 })
  }

  const adapter = adapters[game]
  if (!adapter) {
    return NextResponse.json({ error: 'Unknown game. Use mtg, pokemon, or onepiece.' }, { status: 400 })
  }

  try {
    const result = await adapter.search(q)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Search failed. Please try again.' }, { status: 500 })
  }
}

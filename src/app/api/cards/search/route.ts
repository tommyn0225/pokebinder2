import { NextRequest, NextResponse } from 'next/server'
import { scryfallAdapter } from '@/lib/adapters/scryfall'
import { pokewalletAdapter } from '@/lib/adapters/pokewallet'
import { optcgAdapter } from '@/lib/adapters/optcg'
import type { GameAdapter, SearchFilters } from '@/types/card'

const adapters: Record<string, GameAdapter> = {
  mtg: scryfallAdapter,
  pokemon: pokewalletAdapter,
  onepiece: optcgAdapter,
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const q = params.get('q')?.trim() ?? ''
  const game = params.get('game') ?? 'mtg'

  const filters: SearchFilters = {}
  const set = params.get('set')
  if (set) filters.set = set
  const colors = params.get('colors')
  if (colors) filters.colors = colors.split(',').filter(Boolean)
  const type = params.get('type')
  if (type) filters.type = type
  const rarity = params.get('rarity')
  if (rarity) filters.rarity = rarity
  const priceMin = params.get('priceMin')
  if (priceMin) filters.priceMin = parseFloat(priceMin)
  const priceMax = params.get('priceMax')
  if (priceMax) filters.priceMax = parseFloat(priceMax)

  // Need at least a query or a filter to search
  const hasFilter = Object.keys(filters).length > 0
  if (!q && !hasFilter) {
    return NextResponse.json({ error: 'Provide a search query or at least one filter.' }, { status: 400 })
  }
  if (q && q.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters.' }, { status: 400 })
  }

  const adapter = adapters[game]
  if (!adapter) {
    return NextResponse.json({ error: 'Unknown game. Use mtg, pokemon, or onepiece.' }, { status: 400 })
  }

  try {
    const result = await adapter.search(q, filters)
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    })
  } catch {
    return NextResponse.json({ error: 'Search failed. Please try again.' }, { status: 500 })
  }
}

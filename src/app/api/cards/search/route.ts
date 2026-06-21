import { NextRequest, NextResponse } from 'next/server'
import { scryfallAdapter } from '@/lib/adapters/scryfall'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const game = req.nextUrl.searchParams.get('game') ?? 'mtg'

  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters.' }, { status: 400 })
  }

  if (game !== 'mtg') {
    return NextResponse.json({ error: 'Only mtg is supported right now.' }, { status: 400 })
  }

  try {
    const result = await scryfallAdapter.search(q)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Search failed. Please try again.' }, { status: 500 })
  }
}

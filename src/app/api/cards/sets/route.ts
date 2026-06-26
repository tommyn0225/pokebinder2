import { NextRequest, NextResponse } from 'next/server'
import { getCached, setCached } from '@/lib/cache'

const TTL = 60 * 60 * 24 // 24h

export interface SetInfo {
  id: string
  name: string
  code: string | null
  card_count: number
  release_date: string | null
}

async function getMtgSets(): Promise<SetInfo[]> {
  const key = 'sets:mtg'
  const cached = await getCached<SetInfo[]>(key)
  if (cached) return cached

  const res = await fetch('https://api.scryfall.com/sets', {
    headers: {
      'User-Agent': 'PokeBinder/1.0 (collection tracker; contact: tommyn0225@gmail.com)',
      'Accept': 'application/json',
    },
  })
  if (!res.ok) throw new Error('Failed to fetch MTG sets')
  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sets: SetInfo[] = data.data.map((s: any) => ({
    id: s.code,
    name: s.name,
    code: s.code,
    card_count: s.card_count,
    release_date: s.released_at ?? null,
  }))
  await setCached(key, sets, TTL)
  return sets
}

async function getPokemonSets(): Promise<SetInfo[]> {
  const key = 'sets:pokemon'
  const cached = await getCached<SetInfo[]>(key)
  if (cached) return cached

  const apiKey = process.env.POKEWALLET_API_KEY
  if (!apiKey) throw new Error('POKEWALLET_API_KEY not set')

  const res = await fetch('https://api.pokewallet.io/sets', {
    headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error('Failed to fetch Pokémon sets')
  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sets: SetInfo[] = (data.data ?? []).map((s: any) => ({
    id: s.set_id,
    name: s.name,
    code: s.set_code ?? null,
    card_count: s.card_count,
    release_date: s.release_date ?? null,
  }))
  await setCached(key, sets, TTL)
  return sets
}

async function getOnePieceSets(): Promise<SetInfo[]> {
  const key = 'sets:onepiece'
  const cached = await getCached<SetInfo[]>(key)
  if (cached) return cached

  const apiKey = process.env.POKEWALLET_API_KEY
  if (!apiKey) throw new Error('POKEWALLET_API_KEY not set')

  const res = await fetch('https://api.pokewallet.io/op/sets?language=en', {
    headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error('Failed to fetch One Piece sets')
  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = Array.isArray(data) ? data : (data.data ?? [])
  const sets: SetInfo[] = raw.map((s: any) => ({
    id: s.group_id ?? s.set_id ?? s.id,
    name: s.name,
    code: s.set_code ?? null,
    card_count: s.card_count ?? 0,
    release_date: s.release_date ?? null,
  }))
  await setCached(key, sets, TTL)
  return sets
}

export async function GET(req: NextRequest) {
  const game = req.nextUrl.searchParams.get('game') ?? 'mtg'
  try {
    let sets: SetInfo[]
    if (game === 'mtg') sets = await getMtgSets()
    else if (game === 'pokemon') sets = await getPokemonSets()
    else if (game === 'onepiece') sets = await getOnePieceSets()
    else return NextResponse.json({ error: 'Unknown game' }, { status: 400 })
    return NextResponse.json(sets, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load sets' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import type { Card } from '@/types/card'
import type { Finish } from '@/types/holding'

// Attribution is a license condition of our upstream sources and must ride along
// with every public API response (see CLAUDE.md "Respect upstream terms").
export const ATTRIBUTION =
  'Card data and pricing courtesy of Scryfall (MTG), PokéWallet (Pokémon), and OPTCG API (One Piece). ' +
  'Binder is an independent, non-commercial tool and exposes only its own value-added layer (binders, holdings, valuation, price history).'

// Public, read-only endpoints: allow cross-origin GETs and cache briefly.
export const V1_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
}

// Every v1 error uses one envelope: { error: { code, message } }. `code` is a
// stable machine string; `message` is human-readable and may change.
export type V1ErrorCode = 'invalid_request' | 'not_found' | 'rate_limited' | 'internal'

export function v1Error(
  status: number,
  code: V1ErrorCode,
  message: string,
  extraHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { ...V1_HEADERS, ...(extraHeaders ?? {}) } }
  )
}

// Weak FNV-1a hash of the serialized body — enough for ETag revalidation
// without pulling in a crypto dependency, and runtime-agnostic.
function weakEtag(body: unknown): string {
  const s = JSON.stringify(body)
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `W/"${(h >>> 0).toString(16)}-${s.length}"`
}

// JSON response for v1 GETs with an ETag; returns 304 when the client's
// If-None-Match already matches this exact payload.
export function v1Json(
  request: Request,
  body: unknown,
  extraHeaders?: Record<string, string>
): NextResponse {
  const etag = weakEtag(body)
  const headers = { ...V1_HEADERS, ETag: etag, ...(extraHeaders ?? {}) }
  if (request.headers.get('If-None-Match') === etag) {
    return new NextResponse(null, { status: 304, headers })
  }
  return NextResponse.json(body, { headers })
}

export const GAMES = ['mtg', 'pokemon', 'onepiece'] as const

export function isGame(value: string): value is Card['game'] {
  return (GAMES as readonly string[]).includes(value)
}

export interface ApiCard {
  card_id: string
  name: string
  game: Card['game']
  set_name: string
  set_code: string
  collector_number: string
  rarity: string | null
  image_url: string | null
  quantity: number
  finish: Finish
  for_trade?: boolean
  price: Card['price']
}

export function serializeHolding(
  h: { quantity: number; finish?: Finish; for_trade?: boolean; card_data: Card },
  opts: { includeForTrade?: boolean } = {}
): ApiCard {
  const c = h.card_data
  const card: ApiCard = {
    card_id: c.id,
    name: c.name,
    game: c.game,
    set_name: c.set_name,
    set_code: c.set_code,
    collector_number: c.collector_number,
    rarity: c.rarity,
    image_url: c.image_url,
    quantity: h.quantity,
    finish: h.finish ?? 'nonfoil',
    price: c.price,
  }
  if (opts.includeForTrade) card.for_trade = h.for_trade ?? false
  return card
}

// A catalog entry is a card without holding context (no quantity/finish/
// for_trade): the catalog spans all users, so per-holding fields must not leak.
export type CatalogCard = Omit<ApiCard, 'quantity' | 'finish' | 'for_trade'>

export function serializeCard(c: Card): CatalogCard {
  return {
    card_id: c.id,
    name: c.name,
    game: c.game,
    set_name: c.set_name,
    set_code: c.set_code,
    collector_number: c.collector_number,
    rarity: c.rarity,
    image_url: c.image_url,
    price: c.price,
  }
}

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const key = process.env.POKEWALLET_API_KEY
  if (!key) return NextResponse.json({ error: 'Pokémon images unavailable' }, { status: 503 })

  const upstream = await fetch(`https://api.pokewallet.io/images/${encodeURIComponent(id)}`, {
    headers: { 'X-API-Key': key },
  })

  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status })
  }

  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
  const body = await upstream.arrayBuffer()

  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

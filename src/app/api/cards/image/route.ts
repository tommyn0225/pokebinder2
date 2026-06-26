import { NextRequest, NextResponse } from 'next/server'
import { getCached, setCached } from '@/lib/cache'

const IMAGE_TTL = 60 * 60 * 24 * 7 // 7 days

interface CachedImage {
  b64: string
  contentType: string
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const key = process.env.POKEWALLET_API_KEY
  if (!key) return NextResponse.json({ error: 'Images unavailable' }, { status: 503 })

  const cacheKey = `image:${id}`
  const cached = await getCached<CachedImage>(cacheKey)
  if (cached) {
    const buf = Buffer.from(cached.b64, 'base64')
    return new NextResponse(buf, {
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    })
  }

  const upstream = await fetch(`https://api.pokewallet.io/images/${encodeURIComponent(id)}`, {
    headers: { 'X-API-Key': key },
  })

  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status })
  }

  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
  const buf = Buffer.from(await upstream.arrayBuffer())

  // Cache only reasonably-sized images (skip anything > 500KB)
  if (buf.byteLength < 500_000) {
    await setCached<CachedImage>(cacheKey, { b64: buf.toString('base64'), contentType }, IMAGE_TTL)
  }

  return new NextResponse(buf, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, immutable',
    },
  })
}

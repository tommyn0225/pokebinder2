import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Per-IP fixed-window rate limit for the public v1 API. Backed by a Postgres
// counter (see the api_rate_limits migration) so it survives serverless cold
// starts and multiple instances. Generous by design — the goal is stopping a
// runaway scraper from burning the free-tier quota, not gatekeeping.
const V1_RATE_LIMIT = 60          // requests
const V1_RATE_WINDOW_SECONDS = 60 // per minute

async function rateLimitV1(request: NextRequest): Promise<NextResponse | null> {
  // Only reads are rate-limited; don't penalize CORS preflights.
  if (request.method !== 'GET') return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  // Fail open if the limiter isn't configured — never take down the API over it.
  if (!supabaseUrl || !serviceKey) return null

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/hit_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        p_bucket: `v1:${ip}`,
        p_limit: V1_RATE_LIMIT,
        p_window_seconds: V1_RATE_WINDOW_SECONDS,
      }),
    })
    if (res.ok && (await res.json()) === false) {
      return NextResponse.json(
        {
          error: {
            code: 'rate_limited',
            message: `Rate limit exceeded. Max ${V1_RATE_LIMIT} requests per minute.`,
          },
        },
        {
          status: 429,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Retry-After': String(V1_RATE_WINDOW_SECONDS),
          },
        }
      )
    }
  } catch {
    // Limiter unreachable — fail open rather than block legitimate traffic.
  }
  return null
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public v1 API: rate-limit only, and skip the auth/session work below.
  if (pathname.startsWith('/api/v1')) {
    return (await rateLimitV1(request)) ?? NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/api/v1/:path*'],
}

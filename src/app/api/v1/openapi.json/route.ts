import { NextResponse } from 'next/server'
import { V1_HEADERS, v1Json } from '@/lib/publicApi'
// Single source of truth for the spec, shared with the Mintlify docs.
import spec from '../../../../../docs/openapi.json'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: V1_HEADERS })
}

export async function GET(request: Request) {
  return v1Json(request, spec)
}

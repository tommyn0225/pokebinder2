// Minimal server-side error logging. Routes return sanitized messages to
// clients; this records the real cause to stdout (captured by Vercel) so
// adapter failures, upstream quota exhaustion, and DB errors aren't invisible.
export function logError(route: string, err: unknown): void {
  const detail = err instanceof Error ? (err.stack ?? err.message) : String(err)
  console.error(`[${route}] ${detail}`)
}

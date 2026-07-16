// Minimal server-side error logging. Routes return sanitized messages to
// clients; this records the real cause to stdout (captured by Vercel) so
// adapter failures, upstream quota exhaustion, and DB errors aren't invisible.
export function logError(route: string, err: unknown): void {
  let detail: string
  if (err instanceof Error) {
    detail = err.stack ?? err.message
  } else {
    // Supabase PostgrestErrors aren't Error instances — String() renders them
    // as "[object Object]", hiding the code/message/details. Serialize instead.
    try {
      detail = JSON.stringify(err)
    } catch {
      detail = String(err)
    }
  }
  console.error(`[${route}] ${detail}`)
}

// Trigger the daily price-snapshot job against a running dev server.
// Usage: npm run snapshot   (requires SNAPSHOT_SECRET in .env.local)
// Without this, charts and price history stay empty forever in local dev —
// the production job runs on a schedule that never touches your machine.
import { readFileSync } from 'node:fs'

let env = {}
try {
  env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
      .split('\n')
      .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
      })
  )
} catch {
  console.error('Could not read .env.local — run this from the project root.')
  process.exit(1)
}

const secret = env.SNAPSHOT_SECRET
if (!secret) {
  console.error('SNAPSHOT_SECRET is not set in .env.local')
  process.exit(1)
}

const base = process.env.SNAPSHOT_URL ?? 'http://localhost:3000'

try {
  const res = await fetch(`${base}/api/snapshots`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  })
  const body = await res.text()
  if (!res.ok) {
    console.error(`Snapshot failed: ${res.status}\n${body}`)
    process.exit(1)
  }
  console.log(`Snapshot ok: ${body}`)
} catch (err) {
  console.error(`Could not reach ${base} — is the dev server running?`)
  console.error(String(err))
  process.exit(1)
}

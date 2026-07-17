import type { Finish } from '@/types/holding'

// MTG deck-list text format (Moxfield / Archidekt style). One card per line:
//   <qty> <name> (setcode) [category] ^label,#color^ *F*
// Quantity (`2` or `2x`) defaults to 1. A set code in parentheses picks a
// specific printing. Bracket categories and ^...^ tags are recognized and
// discarded — we have no field for them, but tolerating them means a list
// pasted straight out of Moxfield/Archidekt imports cleanly. `*F*` marks a
// foil copy. Blank lines and comments (`#` or `//`) are skipped, as are the
// section headers those tools emit ("Deck", "Sideboard:", …).
//
// This is MTG-only on purpose: deck-list interchange is an MTG-community
// convention, so import/export only exist on MTG binders.

export interface DeckListRow {
  raw: string // the original line, for reporting back to the user
  quantity: number
  name: string
  setCode: string | null
  finish: Finish
}

export interface DeckListError {
  raw: string
  reason: string
}

export interface ParsedDeckList {
  rows: DeckListRow[]
  errors: DeckListError[]
}

// Lines that appear alone as structural markers in exported lists, not cards.
const SECTION_HEADERS = new Set([
  'deck',
  'sideboard',
  'commander',
  'companion',
  'maybeboard',
  'tokens',
])

export function parseDeckList(text: string): ParsedDeckList {
  const rows: DeckListRow[] = []
  const errors: DeckListError[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim()
    if (!raw) continue
    if (raw.startsWith('#') || raw.startsWith('//')) continue
    // Section headers: a bare keyword, or anything ending in a colon.
    if (raw.endsWith(':') || SECTION_HEADERS.has(raw.toLowerCase())) continue

    let rest = raw

    // Foil marker: *F* / *f* (Moxfield). Etched/other star tokens are stripped
    // as decoration but only *F* flips the finish.
    const finish: Finish = /\*f\*/i.test(rest) ? 'foil' : 'nonfoil'
    rest = rest.replace(/\*[^*]*\*/g, ' ')

    // ^label,#color^ tags and [category] tags — discarded.
    rest = rest.replace(/\^[^^]*\^/g, ' ')
    rest = rest.replace(/\[[^\]]*\]/g, ' ')

    // First (setcode) becomes the printing hint; all parentheticals removed.
    let setCode: string | null = null
    const setMatch = rest.match(/\(([^)]+)\)/)
    if (setMatch) setCode = setMatch[1].trim().toLowerCase() || null
    rest = rest.replace(/\([^)]*\)/g, ' ')

    // Leading quantity: `2` or `2x` (case-insensitive), then the name.
    let quantity = 1
    const qtyMatch = rest.match(/^(\d+)\s*x?\s+/i)
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10)
      rest = rest.slice(qtyMatch[0].length)
    }

    const name = rest.replace(/\s+/g, ' ').trim()
    if (!name) {
      errors.push({ raw, reason: 'Could not read a card name' })
      continue
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      errors.push({ raw, reason: 'Invalid quantity' })
      continue
    }

    rows.push({ raw, quantity, name, setCode, finish })
  }

  return { rows, errors }
}

type ExportHolding = {
  quantity: number
  finish: Finish
  card_data: { name: string; set_code: string | null }
}

// Serialize holdings back to the deck-list text format so an export re-imports
// cleanly. One line per stack: `<qty> <name> (set) *F*`.
export function holdingsToDeckList(holdings: ExportHolding[]): string {
  const lines = holdings.map((h) => {
    const qty = Math.max(1, Math.floor(h.quantity))
    const set = h.card_data.set_code ? ` (${h.card_data.set_code})` : ''
    const foil = h.finish === 'foil' ? ' *F*' : ''
    return `${qty} ${h.card_data.name}${set}${foil}`
  })
  return lines.join('\n')
}

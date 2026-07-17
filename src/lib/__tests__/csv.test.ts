import { describe, expect, it } from 'vitest'
import { csvField, toCsv } from '@/lib/csv'
import { holdingsToCsv } from '@/lib/holdingsExport'
import type { Holding } from '@/types/holding'

describe('csvField', () => {
  it('leaves plain values unquoted', () => {
    expect(csvField('149')).toBe('149')
    expect(csvField('nonfoil')).toBe('nonfoil')
  })

  it('quotes and escapes values with commas, quotes, or newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('line1\nline2')).toBe('"line1\nline2"')
  })
})

describe('toCsv', () => {
  it('joins a header and rows with CRLF', () => {
    const csv = toCsv(['a', 'b'], [['1', '2'], ['3', '4']])
    expect(csv).toBe('a,b\r\n1,2\r\n3,4')
  })

  it('coerces numbers to strings', () => {
    expect(toCsv(['n'], [[42]])).toBe('n\r\n42')
  })
})

// Minimal holding factory for the export shape (only reads quantity/finish/
// card_data.collector_number).
function h(collector_number: string, finish: Holding['finish'], quantity: number): Holding {
  return {
    id: 'x', binder_id: 'b', user_id: 'u', card_id: 'c', game: 'mtg',
    quantity, finish, for_trade: false, acquired_price_usd: null,
    acquired_at: '2026-01-01', created_at: '2026-01-01',
    card_data: {
      id: 'c', game: 'mtg', name: 'Card', set_name: '', set_code: '',
      collector_number, image_url: null, type_line: null, rarity: null,
      price: { usd: null, usd_foil: null, eur: null },
    },
  }
}

describe('holdingsToCsv', () => {
  it('emits the two-column header and one row per copy', () => {
    const csv = holdingsToCsv([h('149', 'nonfoil', 2), h('098/SV-P', 'foil', 1)])
    expect(csv).toBe(
      'collector_number,finish\r\n149,nonfoil\r\n149,nonfoil\r\n098/SV-P,foil'
    )
  })

  it('expands quantity into repeated rows (a qty-3 holding = 3 lines)', () => {
    const csv = holdingsToCsv([h('001', 'nonfoil', 3)])
    const rows = csv.split('\r\n')
    expect(rows).toHaveLength(4) // header + 3 copies
    expect(rows.slice(1)).toEqual(['001,nonfoil', '001,nonfoil', '001,nonfoil'])
  })

  it('is just a header when there are no holdings', () => {
    expect(holdingsToCsv([])).toBe('collector_number,finish')
  })
})

import { describe, it, expect } from 'vitest'
import { parseDeckList, holdingsToDeckList } from '@/lib/mtgDeckList'

describe('parseDeckList', () => {
  it('parses quantity forms (bare, x-suffix, default 1)', () => {
    const { rows } = parseDeckList("2 Sensei's Divining Top\n2x Sol Ring\nMox Opal")
    expect(rows.map((r) => [r.quantity, r.name])).toEqual([
      [2, "Sensei's Divining Top"],
      [2, 'Sol Ring'],
      [1, 'Mox Opal'],
    ])
  })

  it('extracts the set code and strips category/label tags', () => {
    const { rows } = parseDeckList('1x Path to Exile (cmm) [Removal] ^To Remove,#FF0000^')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      quantity: 1,
      name: 'Path to Exile',
      setCode: 'cmm',
      finish: 'nonfoil',
    })
  })

  it('detects *F* as foil and removes the marker from the name', () => {
    const { rows } = parseDeckList('3 Rhystic Study (c21) *F*')
    expect(rows[0]).toMatchObject({ quantity: 3, name: 'Rhystic Study', setCode: 'c21', finish: 'foil' })
  })

  it('skips blank lines, comments, and section headers', () => {
    const { rows } = parseDeckList('Deck\n\n# a comment\n// another\nSideboard:\n1 Brainstorm')
    expect(rows.map((r) => r.name)).toEqual(['Brainstorm'])
  })

  it('reports a line with no readable name as an error', () => {
    const { rows, errors } = parseDeckList('2 (foo) [bar]')
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(/name/i)
  })

  it('keeps commas and apostrophes inside names', () => {
    const { rows } = parseDeckList("1 Yawgmoth, Thran Physician")
    expect(rows[0].name).toBe('Yawgmoth, Thran Physician')
  })
})

describe('holdingsToDeckList', () => {
  const h = (name: string, set: string, qty: number, finish: 'nonfoil' | 'foil') => ({
    quantity: qty,
    finish,
    card_data: { name, set_code: set },
  })

  it('emits one line per stack with set and foil marker', () => {
    const text = holdingsToDeckList([
      h('Sol Ring', 'c21', 2, 'nonfoil'),
      h('Rhystic Study', 'c21', 1, 'foil'),
    ])
    expect(text).toBe('2 Sol Ring (c21)\n1 Rhystic Study (c21) *F*')
  })

  it('round-trips through the parser', () => {
    const text = holdingsToDeckList([h('Path to Exile', 'cmm', 1, 'foil')])
    const { rows } = parseDeckList(text)
    expect(rows[0]).toMatchObject({ quantity: 1, name: 'Path to Exile', setCode: 'cmm', finish: 'foil' })
  })

  it('omits the set when absent', () => {
    expect(holdingsToDeckList([h('Black Lotus', '', 1, 'nonfoil')])).toBe('1 Black Lotus')
  })
})

import { toCsv } from '@/lib/csv'
import type { Holding } from '@/types/holding'

// The fixed export shape: two columns, one row per physical copy. A holding of
// quantity 3 expands to 3 identical rows. Quantity is intentionally not a
// column — the row count carries it.
const HEADERS = ['collector_number', 'finish']

type ExportHolding = Pick<Holding, 'quantity' | 'finish'> & {
  card_data: Pick<Holding['card_data'], 'collector_number'>
}

export function holdingsToCsv(holdings: ExportHolding[]): string {
  const rows: string[][] = []
  for (const h of holdings) {
    const copies = Math.max(1, Math.floor(h.quantity))
    for (let i = 0; i < copies; i++) {
      rows.push([h.card_data.collector_number ?? '', h.finish])
    }
  }
  return toCsv(HEADERS, rows)
}

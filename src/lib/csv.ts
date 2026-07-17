// Minimal RFC-4180 CSV serialization. We build our own rather than pull a
// dependency: the export shape is small and fixed, but card names (and future
// columns) can contain commas, quotes, or newlines, so fields must be escaped.

// Escape a single field: quote it when it contains a comma, quote, CR, or LF,
// and double any embedded quotes.
export function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// Serialize a header row + data rows to a CSV string. Rows use CRLF line
// endings per the spec; every cell is coerced to a string and escaped.
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => csvField(String(cell))).join(',')
  )
  return lines.join('\r\n')
}

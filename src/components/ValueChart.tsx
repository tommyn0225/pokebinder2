'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

export interface ValueHistoryPoint {
  day: string
  total_usd: number
}

type Range = '1W' | '1M' | 'YTD' | '1Y'

const RANGES: { label: string; key: Range }[] = [
  { label: '1W', key: '1W' },
  { label: '1M', key: '1M' },
  { label: '1Y', key: '1Y' },
  { label: 'YTD', key: 'YTD' },
]

function cutoffDate(range: Range): Date {
  const now = new Date()
  switch (range) {
    case '1W': return new Date(now.getTime() - 7 * 864e5)
    case '1M': return new Date(now.getTime() - 30 * 864e5)
    case 'YTD': return new Date(now.getFullYear(), 0, 1)
    case '1Y': return new Date(now.getTime() - 365 * 864e5)
  }
}

function formatDay(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* Recharts needs concrete color values, so resolve the CSS tokens at
   runtime and re-resolve when the .dark class flips. */
function useChartColors() {
  const [colors, setColors] = useState({
    grid: '#e4e4e7',
    tick: '#71717a',
    line: '#7c3aed',
    surface: '#ffffff',
    ink: '#18181b',
  })

  useEffect(() => {
    const el = document.documentElement
    function read() {
      const cs = getComputedStyle(el)
      setColors({
        grid: cs.getPropertyValue('--line').trim(),
        tick: cs.getPropertyValue('--muted').trim(),
        line: cs.getPropertyValue('--brand').trim(),
        surface: cs.getPropertyValue('--surface').trim(),
        ink: cs.getPropertyValue('--ink').trim(),
      })
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return colors
}

interface Props {
  /** Endpoint returning `{ history: ValueHistoryPoint[] }`. */
  endpoint: string
  height?: number
}

export default function ValueChart({ endpoint, height = 180 }: Props) {
  const [allData, setAllData] = useState<ValueHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('1M')
  const colors = useChartColors()

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(endpoint)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error)
        setAllData(json.history ?? [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [endpoint])

  const chartData = useMemo(() => {
    const cutoff = cutoffDate(range)
    return allData
      .filter(d => new Date(d.day) >= cutoff)
      .map(d => ({
        day: formatDay(d.day),
        value: Math.round(d.total_usd * 100) / 100,
      }))
  }, [allData, range])

  if (loading) return <p className="text-sm text-muted py-6 text-center">Loading value history…</p>
  if (error) return <p className="text-sm text-red-600 dark:text-red-400 py-6 text-center">Could not load history: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`microlabel px-2 py-1 rounded transition-colors ${
                range === r.key
                  ? 'bg-brand text-brand-contrast'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">
          Prices are snapshotted daily — your first data point lands tomorrow.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: colors.tick }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={v => `$${v}`}
              tick={{ fontSize: 10, fill: colors.tick }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              formatter={(v) => [`$${(v as number).toFixed(2)}`, 'Value']}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: `1px solid ${colors.grid}`,
                background: colors.surface,
                color: colors.ink,
              }}
              labelStyle={{ color: colors.ink }}
              itemStyle={{ color: colors.ink }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={colors.line}
              strokeWidth={2}
              dot={chartData.length === 1 ? { r: 4, fill: colors.line } : false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

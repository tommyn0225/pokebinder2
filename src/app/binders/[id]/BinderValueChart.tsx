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
import type { BinderHistoryPoint } from '@/app/api/snapshots/binder/[id]/route'

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

interface Props {
  binderId: string
}

export default function BinderValueChart({ binderId }: Props) {
  const [allData, setAllData] = useState<BinderHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('1M')

  useEffect(() => {
    fetch(`/api/snapshots/binder/${binderId}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error)
        setAllData(json.history ?? [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [binderId])

  const chartData = useMemo(() => {
    const cutoff = cutoffDate(range)
    return allData
      .filter(d => new Date(d.day) >= cutoff)
      .map(d => ({
        day: formatDay(d.day),
        value: Math.round(d.total_usd * 100) / 100,
      }))
  }, [allData, range])

  if (loading) return <p className="text-sm text-gray-400 py-6 text-center">Loading value history…</p>
  if (error) return <p className="text-sm text-red-500 py-6 text-center">Could not load history: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                range === r.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          No snapshots in this range yet.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={v => `$${v}`}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              formatter={(v) => [`$${(v as number).toFixed(2)}`, 'Value']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              dot={chartData.length === 1 ? { r: 4, fill: '#6366f1' } : false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

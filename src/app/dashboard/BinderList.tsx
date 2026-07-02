'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Binder } from '@/types/binder'

interface BinderWithValue extends Binder {
  total_usd: number
  is_public: boolean
}

export default function BinderList({ initial }: { initial: BinderWithValue[] }) {
  const [binders, setBinders]     = useState<BinderWithValue[]>(initial)
  const [newName, setNewName]     = useState('')
  const [creating, setCreating]   = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError]         = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    const res  = await fetch('/api/binders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const json = await res.json()
    if (!res.ok) setError(json.error ?? 'Failed to create binder')
    else { setBinders(prev => [...prev, { ...json, total_usd: 0, is_public: false }]); setNewName('') }
    setCreating(false)
  }

  async function handleRename(e: React.FormEvent, id: string) {
    e.preventDefault()
    const name = renameValue.trim()
    if (!name) return
    setError(null)
    const res  = await fetch(`/api/binders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const json = await res.json()
    if (!res.ok) setError(json.error ?? 'Failed to rename binder')
    else { setBinders(prev => prev.map(b => b.id === id ? { ...b, ...json } : b)); setRenamingId(null) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this binder and all its cards?')) return
    setError(null)
    const res = await fetch(`/api/binders/${id}`, { method: 'DELETE' })
    if (!res.ok) setError('Failed to delete binder')
    else setBinders(prev => prev.filter(b => b.id !== id))
  }

  async function handleTogglePublic(id: string, current: boolean) {
    const res  = await fetch(`/api/binders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_public: !current }) })
    const json = await res.json()
    if (res.ok) setBinders(prev => prev.map(b => b.id === id ? { ...b, ...json } : b))
  }

  return (
    <div>
      {error && (
        <div className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New binder name…"
          className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating…' : 'New Binder'}
        </button>
      </form>

      {/* Binder list */}
      {binders.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-600">
          <p className="text-4xl mb-3">📂</p>
          <p className="font-medium text-slate-600 dark:text-slate-400">No binders yet</p>
          <p className="text-sm mt-1">Create one above to start tracking your collection.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {binders.map(binder => (
            <li
              key={binder.id}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 flex items-center justify-between gap-4 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
            >
              {renamingId === binder.id ? (
                <form onSubmit={e => handleRename(e, binder.id)} className="flex gap-2 flex-1">
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <button type="submit" className="text-sm text-violet-600 dark:text-violet-400 font-semibold hover:underline">Save</button>
                  <button type="button" onClick={() => setRenamingId(null)} className="text-sm text-slate-400 hover:underline">Cancel</button>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <Link
                      href={`/binders/${binder.id}`}
                      className="font-semibold text-slate-900 dark:text-slate-100 hover:text-violet-600 dark:hover:text-violet-400 transition-colors truncate"
                    >
                      {binder.name}
                    </Link>
                    {binder.is_public && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                        Public
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ${binder.total_usd.toFixed(2)}
                    </span>
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleTogglePublic(binder.id, binder.is_public)}
                        className="text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors text-xs"
                      >
                        {binder.is_public ? 'Make private' : 'Make public'}
                      </button>
                      <button
                        onClick={() => { setRenamingId(binder.id); setRenameValue(binder.name) }}
                        className="text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDelete(binder.id)}
                        className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

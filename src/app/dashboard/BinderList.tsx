'use client'

import { useEffect, useRef, useState } from 'react'
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpenId) return
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpenId(null)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpenId])

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
        <div className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
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
          className="flex-1 rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="control-label rounded-md bg-brand hover:bg-brand-hover text-brand-contrast px-5 py-2.5 disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating…' : 'New binder'}
        </button>
      </form>

      {/* Binder list */}
      {binders.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface text-center py-16">
          <p className="font-semibold text-ink">No binders yet</p>
          <p className="text-sm text-muted mt-1">Create one above to start tracking your collection.</p>
        </div>
      ) : (
        <ul className="rounded-xl border border-line bg-surface divide-y divide-line">
          {binders.map(binder => (
            <li key={binder.id} className="px-5 py-4 flex items-center justify-between gap-4">
              {renamingId === binder.id ? (
                <form onSubmit={e => handleRename(e, binder.id)} className="flex gap-2 flex-1">
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    className="flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-brand"
                  />
                  <button type="submit" className="text-sm font-semibold text-brand hover:underline">Save</button>
                  <button type="button" onClick={() => setRenamingId(null)} className="text-sm text-muted hover:underline">Cancel</button>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <Link
                      href={`/binders/${binder.id}`}
                      className="font-semibold text-ink hover:text-brand transition-colors truncate"
                    >
                      {binder.name}
                    </Link>
                    {binder.is_public ? (
                      <span className="microlabel shrink-0 rounded border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2 py-0.5">
                        Public
                      </span>
                    ) : (
                      <span className="microlabel shrink-0 rounded border border-line text-muted px-2 py-0.5">
                        Private
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono text-sm text-ink">
                      ${binder.total_usd.toFixed(2)}
                    </span>
                    <div className="relative" ref={menuOpenId === binder.id ? menuRef : undefined}>
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === binder.id ? null : binder.id)}
                        aria-label={`Actions for ${binder.name}`}
                        aria-haspopup="menu"
                        aria-expanded={menuOpenId === binder.id}
                        className="w-8 h-8 rounded-md border border-line flex items-center justify-center text-muted hover:text-ink hover:border-ink transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="5" cy="12" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="19" cy="12" r="1.5" />
                        </svg>
                      </button>
                      {menuOpenId === binder.id && (
                        <div role="menu" className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-line bg-surface py-1 shadow-md z-10">
                          <button
                            role="menuitem"
                            onClick={() => { setMenuOpenId(null); setRenamingId(binder.id); setRenameValue(binder.name) }}
                            className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-background transition-colors"
                          >
                            Rename
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => { setMenuOpenId(null); handleTogglePublic(binder.id, binder.is_public) }}
                            className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-background transition-colors"
                          >
                            {binder.is_public ? 'Make private' : 'Make public'}
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => { setMenuOpenId(null); handleDelete(binder.id) }}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
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

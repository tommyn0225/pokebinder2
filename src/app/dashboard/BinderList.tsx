'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Binder } from '@/types/binder'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import ShareDialog from '@/components/ShareDialog'

interface BinderWithValue extends Binder {
  total_usd: number
  is_public: boolean
}

type GameKey = Binder['game']

const GAMES: { key: GameKey; label: string }[] = [
  { key: 'mtg',      label: 'MTG' },
  { key: 'pokemon',  label: 'Pokémon' },
  { key: 'onepiece', label: 'One Piece' },
]

const MAX_BINDERS = 3

function gameLabel(game: GameKey): string {
  return GAMES.find(g => g.key === game)?.label ?? game
}

export default function BinderList({ initial }: { initial: BinderWithValue[] }) {
  const [binders, setBinders]     = useState<BinderWithValue[]>(initial)
  const [newName, setNewName]     = useState('')
  const [newGame, setNewGame]     = useState<GameKey>('mtg')
  const [creating, setCreating]   = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BinderWithValue | null>(null)
  const [shareBinder, setShareBinder] = useState<BinderWithValue | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const toast = useToast()

  const atLimit = binders.length >= MAX_BINDERS

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
    const res  = await fetch('/api/binders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, game: newGame }) })
    const json = await res.json()
    if (!res.ok) toast(json.error ?? 'Failed to create binder', 'error')
    else { setBinders(prev => [...prev, { ...json, total_usd: 0, is_public: false }]); setNewName('') }
    setCreating(false)
  }

  async function handleRename(e: React.FormEvent, id: string) {
    e.preventDefault()
    const name = renameValue.trim()
    if (!name) return
    const res  = await fetch(`/api/binders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const json = await res.json()
    if (!res.ok) toast(json.error ?? 'Failed to rename binder', 'error')
    else { setBinders(prev => prev.map(b => b.id === id ? { ...b, ...json } : b)); setRenamingId(null) }
  }

  async function confirmDelete() {
    const binder = pendingDelete
    if (!binder) return
    setPendingDelete(null)
    const res = await fetch(`/api/binders/${binder.id}`, { method: 'DELETE' })
    if (!res.ok) toast('Failed to delete binder', 'error')
    else {
      setBinders(prev => prev.filter(b => b.id !== binder.id))
      toast(`Deleted "${binder.name}"`, 'success')
    }
  }

  async function handleTogglePublic(id: string, current: boolean) {
    const res  = await fetch(`/api/binders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_public: !current }) })
    const json = await res.json()
    if (!res.ok) { toast('Failed to update binder', 'error'); return }
    setBinders(prev => prev.map(b => b.id === id ? { ...b, ...json } : b))
    toast(current ? 'Binder is now private' : 'Binder is now public', 'success')
  }

  return (
    <div>
      {/* Binder list */}
      {binders.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface text-center py-16">
          <p className="font-semibold text-ink">No binders yet</p>
          <p className="text-sm text-muted mt-1">Create one below to start tracking your collection.</p>
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
                    <span className="microlabel shrink-0 rounded border border-line bg-background text-muted px-2 py-0.5">
                      {gameLabel(binder.game)}
                    </span>
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
                            onClick={() => { setMenuOpenId(null); setShareBinder(binder) }}
                            className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-background transition-colors"
                          >
                            Share
                          </button>
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
                            onClick={() => { setMenuOpenId(null); setPendingDelete(binder) }}
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

      {/* Create binder — below existing binders */}
      <div className="mt-6">
        {atLimit ? (
          <div className="rounded-xl border border-dashed border-line bg-surface px-5 py-4 text-center">
            <p className="text-sm text-muted">
              You’ve reached the limit of {MAX_BINDERS} binders. Delete one to create another.
            </p>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="rounded-xl border border-line bg-surface p-5">
            <h2 className="microlabel text-muted mb-3">New binder</h2>

            {/* Game selector — a binder holds one game */}
            <div className="mb-3 flex w-fit divide-x divide-line rounded-md border border-line overflow-hidden">
              {GAMES.map(g => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setNewGame(g.key)}
                  aria-pressed={newGame === g.key}
                  className={`microlabel px-3 py-1.5 transition-colors ${
                    newGame === g.key
                      ? 'bg-brand text-brand-contrast'
                      : 'bg-surface text-muted hover:text-ink'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Binder name…"
                className="flex-1 rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand"
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="control-label rounded-md bg-brand hover:bg-brand-hover text-brand-contrast px-5 py-2.5 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete binder"
        message={`Delete "${pendingDelete?.name}" and all its cards? This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {shareBinder && (
        <ShareDialog
          title={`Share “${shareBinder.name}”`}
          path={`/b/${shareBinder.id}`}
          isPublic={shareBinder.is_public}
          privateNote="This binder is private. The link won’t open for anyone until you make the binder public."
          onClose={() => setShareBinder(null)}
        />
      )}
    </div>
  )
}

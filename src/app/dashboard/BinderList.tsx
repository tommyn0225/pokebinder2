'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Binder } from '@/types/binder'

interface Props {
  initial: Binder[]
}

export default function BinderList({ initial }: Props) {
  const [binders, setBinders] = useState<Binder[]>(initial)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    const res = await fetch('/api/binders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to create binder')
    } else {
      setBinders(prev => [...prev, json])
      setNewName('')
    }
    setCreating(false)
  }

  function startRename(binder: Binder) {
    setRenamingId(binder.id)
    setRenameValue(binder.name)
  }

  async function handleRename(e: React.FormEvent, id: string) {
    e.preventDefault()
    const name = renameValue.trim()
    if (!name) return
    setError(null)
    const res = await fetch(`/api/binders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to rename binder')
    } else {
      setBinders(prev => prev.map(b => (b.id === id ? json : b)))
      setRenamingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this binder?')) return
    setError(null)
    const res = await fetch(`/api/binders/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Failed to delete binder')
    } else {
      setBinders(prev => prev.filter(b => b.id !== id))
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New binder name…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating…' : 'Create Binder'}
        </button>
      </form>

      {binders.length === 0 ? (
        <p className="text-center text-gray-400 py-12">
          No binders yet — create one above.
        </p>
      ) : (
        <ul className="space-y-3">
          {binders.map(binder => (
            <li
              key={binder.id}
              className="bg-white border rounded-lg px-4 py-3 flex items-center justify-between gap-4"
            >
              {renamingId === binder.id ? (
                <form
                  onSubmit={e => handleRename(e, binder.id)}
                  className="flex gap-2 flex-1"
                >
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="submit"
                    className="text-sm text-indigo-600 font-medium hover:underline"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="text-sm text-gray-400 hover:underline"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <Link
                    href={`/binders/${binder.id}`}
                    className="font-medium text-gray-800 hover:text-indigo-600 transition-colors"
                  >
                    {binder.name}
                  </Link>
                  <div className="flex gap-3 text-sm">
                    <button
                      onClick={() => startRename(binder)}
                      className="text-gray-500 hover:text-indigo-600 transition-colors"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(binder.id)}
                      className="text-gray-500 hover:text-red-600 transition-colors"
                    >
                      Delete
                    </button>
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

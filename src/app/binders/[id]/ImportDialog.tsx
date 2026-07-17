'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'

interface MatchedPreview {
  raw: string
  quantity: number
  finish: 'nonfoil' | 'foil'
  name: string
  set_code: string
  collector_number: string
}

interface UnmatchedPreview {
  raw: string
  name: string
  reason: string
}

interface Preview {
  matched: MatchedPreview[]
  unmatched: UnmatchedPreview[]
}

const PLACEHOLDER = `2 Sensei's Divining Top
2x Sol Ring
1x Path to Exile (cmm) [Removal] ^To Remove,#FF0000^`

export default function ImportDialog({ binderId, onClose }: { binderId: string; onClose: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const totalCopies = preview?.matched.reduce((n, m) => n + m.quantity, 0) ?? 0

  async function post(dryRun: boolean) {
    const res = await fetch(`/api/binders/${binderId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, dryRun }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Import failed')
    return json
  }

  async function handlePreview() {
    setBusy(true)
    try {
      setPreview(await post(true))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    setBusy(true)
    try {
      const res = await post(false)
      toast(`Imported ${res.imported} card${res.imported === 1 ? '' : 's'}.`, 'success')
      router.refresh()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setText(await file.text())
    setPreview(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Import deck list">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-ink">Import deck list</h2>
            <p className="mt-0.5 text-xs text-muted">Magic only · Moxfield / Archidekt text format</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-muted hover:border-ink hover:text-ink transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          One card per line: <code>{'<qty> <name> (set) *F*'}</code>. A set code in parentheses picks that
          printing; <code>*F*</code> marks a foil. Category <code>[tags]</code> and <code>^labels^</code> are ignored.
        </div>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setPreview(null) }}
          placeholder={PLACEHOLDER}
          rows={7}
          className="w-full resize-y rounded-md border border-line bg-bg px-3 py-2 font-mono text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
        />

        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="microlabel text-muted hover:text-brand transition-colors"
          >
            Upload a .txt file
          </button>
          <input ref={fileRef} type="file" accept=".txt,text/plain" onChange={handleFile} className="hidden" />
        </div>

        {preview && (
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-md border border-line">
            <div className="border-b border-line bg-bg px-3 py-2 text-xs text-muted">
              <span className="text-emerald-600 dark:text-emerald-400">{preview.matched.length} matched</span>
              {' · '}
              <span className={preview.unmatched.length ? 'text-red-600 dark:text-red-400' : ''}>
                {preview.unmatched.length} unmatched
              </span>
            </div>
            <ul className="divide-y divide-line text-sm">
              {preview.matched.map((m, i) => (
                <li key={`m${i}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="truncate text-ink">
                    <span className="text-muted">{m.quantity}×</span> {m.name}
                    {m.finish === 'foil' && <span className="ml-1 text-amber-500">✦</span>}
                  </span>
                  <span className="shrink-0 microlabel text-muted uppercase">{m.set_code}</span>
                </li>
              ))}
              {preview.unmatched.map((u, i) => (
                <li key={`u${i}`} className="flex items-center justify-between gap-2 px-3 py-1.5 text-muted">
                  <span className="truncate line-through">{u.name}</span>
                  <span className="shrink-0 text-xs text-red-500">{u.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="microlabel rounded-md border border-line px-3 py-1.5 text-muted hover:text-ink transition-colors">
            Cancel
          </button>
          {!preview ? (
            <button
              onClick={handlePreview}
              disabled={busy || !text.trim()}
              className="microlabel rounded-md border border-brand bg-brand px-3 py-1.5 text-white disabled:opacity-50 transition-opacity"
            >
              {busy ? 'Checking…' : 'Preview'}
            </button>
          ) : (
            <button
              onClick={handleImport}
              disabled={busy || totalCopies === 0}
              className="microlabel rounded-md border border-brand bg-brand px-3 py-1.5 text-white disabled:opacity-50 transition-opacity"
            >
              {busy ? 'Importing…' : `Import ${totalCopies} card${totalCopies === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

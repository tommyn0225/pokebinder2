'use client'

import { useState } from 'react'
import ShareDialog from '@/components/ShareDialog'
import ImportDialog from './ImportDialog'
import type { Binder } from '@/types/binder'

interface BinderHeaderActionsProps {
  binderId: string
  binderName: string
  binderGame: Binder['game']
  initialIsPublic: boolean
}

export default function BinderHeaderActions({ binderId, binderName, binderGame, initialIsPublic }: BinderHeaderActionsProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [saving, setSaving] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportWarnOpen, setExportWarnOpen] = useState(false)

  // Deck-list import/export is an MTG-community convention; only MTG binders
  // get the affordance at all.
  const isMtg = binderGame === 'mtg'

  async function handleToggle() {
    setSaving(true)
    const res = await fetch(`/api/binders/${binderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: !isPublic }),
    })
    if (res.ok) {
      const json = await res.json()
      setIsPublic(json.is_public)
    }
    setSaving(false)
  }

  function handleExport() {
    // Trigger the download, then close the warning.
    window.location.href = `/api/binders/${binderId}/export`
    setExportWarnOpen(false)
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={`microlabel rounded px-2 py-0.5 ${
          isPublic
            ? 'border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
            : 'border border-line text-muted'
        }`}
      >
        {isPublic ? 'Public' : 'Private'}
      </span>
      <button
        onClick={handleToggle}
        disabled={saving}
        className="microlabel text-muted hover:text-brand disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : isPublic ? 'Make private' : 'Make public'}
      </button>
      {isMtg && (
        <>
          <button
            onClick={() => setImportOpen(true)}
            className="microlabel rounded-md border border-line px-3 py-1 text-ink hover:border-brand hover:text-brand transition-colors"
          >
            Import
          </button>
          <button
            onClick={() => setExportWarnOpen(true)}
            className="microlabel rounded-md border border-line px-3 py-1 text-ink hover:border-brand hover:text-brand transition-colors"
          >
            Export
          </button>
        </>
      )}
      <button
        onClick={() => setShareOpen(true)}
        className="microlabel rounded-md border border-line px-3 py-1 text-ink hover:border-brand hover:text-brand transition-colors"
      >
        Share
      </button>

      {shareOpen && (
        <ShareDialog
          title={`Share “${binderName}”`}
          path={`/b/${binderId}`}
          isPublic={isPublic}
          privateNote="This binder is private. The link won’t open for anyone until you make the binder public."
          onClose={() => setShareOpen(false)}
        />
      )}

      {importOpen && <ImportDialog binderId={binderId} onClose={() => setImportOpen(false)} />}

      {exportWarnOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Export deck list">
          <div className="absolute inset-0 bg-black/50" onClick={() => setExportWarnOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-line bg-surface p-5">
            <h2 className="font-semibold text-ink">Export deck list</h2>
            <p className="mt-2 text-sm text-muted">
              Exports as a Magic deck-list text file (Moxfield / Archidekt style): one line per card,
              <code className="mx-1 text-ink">{'<qty> <name> (set) *F*'}</code>.
              Prices, cost basis, and trade status aren’t included.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setExportWarnOpen(false)}
                className="microlabel rounded-md border border-line px-3 py-1.5 text-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="microlabel rounded-md border border-brand bg-brand px-3 py-1.5 text-white transition-opacity hover:opacity-90"
              >
                Download .txt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

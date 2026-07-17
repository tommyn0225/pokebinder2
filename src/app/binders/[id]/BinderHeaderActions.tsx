'use client'

import { useState } from 'react'
import ShareDialog from '@/components/ShareDialog'

interface BinderHeaderActionsProps {
  binderId: string
  binderName: string
  initialIsPublic: boolean
}

export default function BinderHeaderActions({ binderId, binderName, initialIsPublic }: BinderHeaderActionsProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [saving, setSaving] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

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
      <a
        href={`/api/binders/${binderId}/export`}
        download
        className="microlabel rounded-md border border-line px-3 py-1 text-ink hover:border-brand hover:text-brand transition-colors"
      >
        Export CSV
      </a>
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
    </div>
  )
}

'use client'

import { useState } from 'react'

interface BinderVisibilityToggleProps {
  binderId: string
  initialIsPublic: boolean
}

export default function BinderVisibilityToggle({ binderId, initialIsPublic }: BinderVisibilityToggleProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [saving, setSaving] = useState(false)

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
    </div>
  )
}

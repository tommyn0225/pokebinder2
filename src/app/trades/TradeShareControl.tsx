'use client'

import { useState } from 'react'
import ShareDialog from '@/components/ShareDialog'
import { useToast } from '@/components/Toast'

interface TradeShareControlProps {
  token: string
  initialIsPublic: boolean
}

export default function TradeShareControl({ token, initialIsPublic }: TradeShareControlProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [saving, setSaving] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const toast = useToast()

  async function handleToggle() {
    setSaving(true)
    const res = await fetch('/api/trades/share', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: !isPublic }),
    })
    const json = await res.json()
    if (!res.ok) toast(json.error ?? 'Failed to update trade list', 'error')
    else {
      setIsPublic(json.is_public)
      toast(json.is_public ? 'Trade list is now public' : 'Trade list is now private', 'success')
    }
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-3 shrink-0">
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
      <button
        onClick={() => setShareOpen(true)}
        className="microlabel rounded-md border border-line px-3 py-1 text-ink hover:border-brand hover:text-brand transition-colors"
      >
        Share
      </button>

      {shareOpen && (
        <ShareDialog
          title="Share your trade list"
          subtitle="Anyone with the link can see the cards you have up for trade."
          path={`/t/${token}`}
          isPublic={isPublic}
          privateNote="Your trade list is private. The link won’t open for anyone until you make it public."
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}

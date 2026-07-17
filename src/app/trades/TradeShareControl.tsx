'use client'

import { useState } from 'react'
import ShareDialog from '@/components/ShareDialog'

interface TradeShareControlProps {
  token: string
}

export default function TradeShareControl({ token }: TradeShareControlProps) {
  const [shareOpen, setShareOpen] = useState(false)

  return (
    <div className="flex items-center gap-3 shrink-0">
      {/* A trade list only exists to be shared, so it is always public — no gate. */}
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
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}

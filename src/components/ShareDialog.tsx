'use client'

import { useEffect, useState } from 'react'

interface ShareDialogProps {
  /** Heading text, e.g. `Share “MTG”` or `Share your trade list`. */
  title: string
  /** Relative path to share, e.g. `/b/<id>` or `/t/<token>`. */
  path: string
  isPublic: boolean
  /** Shown (in an amber box) when not public. */
  privateNote: string
  subtitle?: string
  onClose: () => void
}

export default function ShareDialog({ title, path, isPublic, privateNote, subtitle, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState(path)

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`)
  }, [path])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard may be unavailable; the link stays visible for manual copy.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-ink truncate">{title}</h2>
            <p className="text-xs text-muted mt-0.5">{subtitle ?? 'Anyone with the link can view this.'}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 shrink-0 rounded-md border border-line flex items-center justify-center text-muted hover:text-ink hover:border-ink transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={url}
            onFocus={e => e.target.select()}
            className="flex-1 min-w-0 rounded-md border border-line bg-background px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-brand"
          />
          <button
            onClick={copy}
            className="control-label shrink-0 rounded-md bg-brand hover:bg-brand-hover text-brand-contrast px-4 py-2 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {!isPublic && (
          <p className="mt-3 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {privateNote}
          </p>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** When set, renders a checkbox; its state is passed to `onConfirm`. */
  suppressLabel?: string
  onConfirm: (suppress?: boolean) => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  suppressLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [suppress, setSuppress] = useState(false)
  useEffect(() => {
    if (!open) return
    setSuppress(false)
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <p className="mt-2 text-sm text-muted">{message}</p>
        {suppressLabel && (
          <label className="mt-4 flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={suppress}
              onChange={e => setSuppress(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-brand"
            />
            {suppressLabel}
          </label>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="control-label rounded-md border border-line bg-surface px-4 py-2 text-ink hover:border-ink transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm(suppress)}
            autoFocus
            className={`control-label rounded-md px-4 py-2 text-white transition-colors ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-brand-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

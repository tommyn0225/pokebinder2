'use client'

import { createContext, useCallback, useContext, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {})

/** Call inside any client component to show a transient toast. */
export function useToast() {
  return useContext(ToastContext)
}

let nextId = 1

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-full max-w-xs pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-md border bg-surface px-4 py-3 text-sm shadow-md border-line"
          >
            <span
              aria-hidden
              className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                t.type === 'success' ? 'bg-emerald-500'
                : t.type === 'error' ? 'bg-red-500'
                : 'bg-brand'
              }`}
            />
            <p className="flex-1 text-ink">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="text-muted hover:text-ink transition-colors leading-none"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

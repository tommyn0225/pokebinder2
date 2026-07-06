'use client'

import { useTheme } from '@/components/ThemeProvider'

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-line last:border-0">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { theme, toggle } = useTheme()

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-ink mb-8">Settings</h1>

      <div className="bg-surface border border-line rounded-xl px-6">
        <h2 className="microlabel text-muted pt-4 pb-2">Appearance</h2>

        <SettingRow
          label="Dark mode"
          description="Switch between light and dark interface"
        >
          <button
            onClick={toggle}
            role="switch"
            aria-checked={theme === 'dark'}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-surface ${
              theme === 'dark' ? 'bg-brand' : 'bg-line'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </SettingRow>
      </div>

      <div className="bg-surface border border-line rounded-xl px-6 mt-4">
        <h2 className="microlabel text-muted pt-4 pb-2">More settings coming soon</h2>
        <div className="py-4 text-sm text-muted">
          Notification preferences, display currency, and more will appear here.
        </div>
      </div>
    </main>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavbarProps {
  userEmail?: string | null
}

export default function Navbar({ userEmail }: NavbarProps) {
  const pathname = usePathname()

  function navLink(href: string, label: string) {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        href={href}
        className={`microlabel transition-colors ${
          active ? 'text-brand' : 'text-muted hover:text-ink'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href={userEmail ? '/dashboard' : '/'} className="flex items-center gap-2 mr-2">
          <span className="text-lg font-bold tracking-tight text-ink">
            Binder<span className="text-brand">.</span>
          </span>
        </Link>

        {/* Nav links */}
        {userEmail && (
          <>
            {navLink('/dashboard', 'Dashboard')}
            {navLink('/search', 'Search')}
          </>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          {userEmail ? (
            <>
              {/* Settings */}
              <Link
                href="/settings"
                aria-label="Settings"
                className="w-8 h-8 rounded-md border border-line bg-surface flex items-center justify-center text-muted hover:text-ink hover:border-ink transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </Link>

              {/* Profile */}
              <Link href="/profile" aria-label="Profile" className="group">
                <div className="w-8 h-8 rounded-md bg-brand flex items-center justify-center text-xs font-bold text-brand-contrast uppercase group-hover:bg-brand-hover transition-colors">
                  {userEmail?.[0] ?? '?'}
                </div>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="control-label text-muted hover:text-ink transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="control-label rounded-md bg-brand px-4 py-2 text-brand-contrast hover:bg-brand-hover transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

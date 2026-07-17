import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/* Mock search results — Lightning Bolt printings, showing per-printing prices.
   Images hotlinked from Scryfall's CDN (permitted; attributed in the footer). */
const searchResults = [
  { set: 'Beta', code: 'LEB · 162', price: '$412.00', img: 'https://cards.scryfall.io/normal/front/b/5/b5d3dcab-2260-479d-9ef6-dfb92d4f6061.jpg', art: 'linear-gradient(135deg, rgba(244,63,94,0.40), rgba(251,146,60,0.30))', foil: null, special: false },
  { set: 'Magic 2010', code: 'M10 · 146', price: '$2.49', img: 'https://cards.scryfall.io/normal/front/4/3/435589bb-27c6-4a6d-9d63-394d5092b9d8.jpg', art: 'linear-gradient(135deg, rgba(244,63,94,0.22), rgba(251,146,60,0.16))', foil: null, special: false },
  { set: 'Double Masters 2022', code: '2X2 · 117', price: '$1.85', img: 'https://cards.scryfall.io/normal/front/f/2/f29ba16f-c8fb-42fe-aabf-87089cb214a7.jpg', art: 'linear-gradient(135deg, rgba(251,146,60,0.24), rgba(250,204,21,0.16))', foil: '$4.20', special: false },
  { set: 'Secret Lair', code: 'SLD · 86', price: '$12.30', img: 'https://cards.scryfall.io/normal/front/c/3/c3eb3895-b64c-46ab-b704-3c46963920ba.jpg', art: 'linear-gradient(135deg, rgba(168,85,247,0.30), rgba(56,189,248,0.22))', foil: null, special: true },
]

/* Mock binder rows */
const binderRows = [
  { name: 'Ragavan, Nimble Pilferer', set: 'MH2', qty: 1, value: '$38.50', img: 'https://cards.scryfall.io/normal/front/a/9/a9738cda-adb1-47fb-9f4c-ecd930228c4d.jpg', foil: false, added: false },
  { name: 'Lightning Bolt', set: '2X2', qty: 4, value: '$16.80', img: 'https://cards.scryfall.io/normal/front/f/2/f29ba16f-c8fb-42fe-aabf-87089cb214a7.jpg', foil: true, added: false },
  { name: 'Counterspell', set: 'MH2', qty: 2, value: '$3.90', img: 'https://cards.scryfall.io/normal/front/1/9/1920dae4-fb92-4f19-ae4b-eb3276b8dac7.jpg', foil: false, added: false },
  { name: 'Thoughtseize', set: '2XM', qty: 1, value: '$14.20', img: 'https://cards.scryfall.io/normal/front/b/2/b281a308-ab6b-47b6-bec7-632c9aaecede.jpg', foil: false, added: false },
  { name: 'Lightning Bolt', set: 'SLD', qty: 1, value: '$12.30', img: 'https://cards.scryfall.io/normal/front/c/3/c3eb3895-b64c-46ab-b704-3c46963920ba.jpg', foil: true, added: true },
]

function BoltGlyph() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink/25">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

/* Showcase 01 — search across games */
function SearchPanel() {
  return (
    <div aria-hidden="true" className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="text-sm text-ink">lightning bolt</span>
        <span className="ml-auto flex gap-1.5">
          <span className="microlabel rounded bg-brand px-2 py-1 text-brand-contrast">MTG</span>
          <span className="microlabel rounded border border-line px-2 py-1 text-muted">PKM</span>
          <span className="microlabel rounded border border-line px-2 py-1 text-muted">OP</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
        {searchResults.map(r => (
          <div key={r.code} className="rounded-lg border border-line p-2">
            <div
              className="relative flex aspect-[5/7] items-center justify-center overflow-hidden rounded bg-background"
              style={{ backgroundImage: r.art }}
            >
              <BoltGlyph />
              <img
                src={r.img}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              {r.special && <div className="foil-shine foil-shine-special" />}
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-tight text-ink">Lightning Bolt</p>
            <p className="microlabel mt-0.5 truncate text-muted">{r.set}</p>
            <p className="mt-1.5 text-xs text-ink">{r.price}</p>
            {r.foil && <p className="microlabel mt-0.5 text-brand">★ {r.foil}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* Showcase 02 — a binder with holdings, one just added */
function BinderPanel() {
  return (
    <div aria-hidden="true" className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink">Modern Staples</span>
        <span className="microlabel text-muted">9 cards · $85.70</span>
      </div>
      <div>
        {binderRows.map((row, i) => (
          <div
            key={`${row.name}-${row.set}`}
            className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-line' : ''} ${row.added ? 'bg-brand/5' : ''}`}
          >
            <img
              src={row.img}
              alt=""
              loading="lazy"
              className="h-10 w-7 shrink-0 rounded-sm border border-line object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{row.name}</p>
              <p className="microlabel mt-0.5 text-muted">
                {row.set}
                {row.foil && <span className="text-brand"> · ★ Foil</span>}
              </p>
            </div>
            {row.added ? (
              <span className="microlabel rounded bg-brand px-2 py-1 text-brand-contrast">Added</span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded border border-line text-muted">−</span>
                <span className="microlabel w-4 text-center text-ink">{row.qty}</span>
                <span className="flex h-5 w-5 items-center justify-center rounded border border-line text-muted">+</span>
              </span>
            )}
            <span className="w-14 text-right text-xs text-ink">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Showcase 03 — collection value over time */
function ValuePanel() {
  return (
    <div aria-hidden="true" className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="microlabel text-muted">Collection value</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-2xl font-bold tracking-tight text-ink">$1,284.52</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">▲ $182.52 · 16.6%</span>
          </div>
          <p className="microlabel mt-1 text-muted">Paid $1,102.00</p>
        </div>
        <span className="flex gap-1.5">
          <span className="microlabel rounded border border-line px-2 py-1 text-muted">7D</span>
          <span className="microlabel rounded bg-brand px-2 py-1 text-brand-contrast">30D</span>
          <span className="microlabel rounded border border-line px-2 py-1 text-muted">90D</span>
        </span>
      </div>
      <div className="p-4">
        <svg viewBox="0 0 460 160" className="h-auto w-full overflow-visible" role="img">
          {/* recessive grid */}
          <line x1="0" y1="30" x2="460" y2="30" className="stroke-line" strokeWidth="1" />
          <line x1="0" y1="70" x2="460" y2="70" className="stroke-line" strokeWidth="1" />
          <line x1="0" y1="110" x2="460" y2="110" className="stroke-line" strokeWidth="1" />
          <line x1="0" y1="150" x2="460" y2="150" className="stroke-line" strokeWidth="1" />
          {/* area fill */}
          <path
            d="M0,118 L40,112 L80,120 L120,106 L160,110 L200,96 L240,101 L280,88 L320,92 L360,74 L400,80 L440,58 L460,52 L460,150 L0,150 Z"
            className="fill-brand/10"
          />
          {/* series line */}
          <path
            d="M0,118 L40,112 L80,120 L120,106 L160,110 L200,96 L240,101 L280,88 L320,92 L360,74 L400,80 L440,58 L460,52"
            className="stroke-brand"
            strokeWidth="2"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* endpoint marker with surface ring */}
          <circle cx="460" cy="52" r="5" className="fill-brand stroke-surface" strokeWidth="2" />
          <text x="452" y="38" textAnchor="end" fontSize="10" className="fill-muted">$1,284</text>
        </svg>
        <div className="mt-2 flex justify-between">
          <span className="microlabel text-muted">Jun 17</span>
          <span className="microlabel text-muted">Jul 17</span>
        </div>
      </div>
    </div>
  )
}

const showcases = [
  {
    index: '01',
    label: 'Search',
    title: 'Three games, one place',
    description:
      'Search cards from Magic: The Gathering, Pokémon, and One Piece with live market prices — down to the exact printing, foil or not.',
    panel: <SearchPanel />,
  },
  {
    index: '02',
    label: 'Binders',
    title: 'Organized in binders',
    description:
      'Create binders for decks, sets, or trades. Add cards with quantities and finishes, and keep everything sorted your way.',
    panel: <BinderPanel />,
  },
  {
    index: '03',
    label: 'Value',
    title: 'Value over time',
    description:
      'Prices are snapshotted daily, so you can watch your collection’s value trend over time — and see what you’ve gained against what you paid.',
    panel: <ValuePanel />,
  },
]

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <main className="max-w-5xl mx-auto px-6">
      {/* Hero */}
      <section className="flex flex-col items-center text-center pt-24 pb-20 sm:pt-32">
        <span className="microlabel rise-in rounded-md border border-line bg-surface px-3 py-1.5 text-muted">
          TCG collection tracker
        </span>
        <h1 className="rise-in mt-8 text-5xl sm:text-6xl font-bold tracking-tight text-ink [animation-delay:60ms]">
          Binder<span className="text-brand">.</span>
        </h1>
        <p className="rise-in mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-ink [animation-delay:120ms]">
          Track your card collection&apos;s real value
        </p>
        <p className="rise-in mt-4 max-w-xl text-base sm:text-lg text-muted [animation-delay:180ms]">
          Organize binders across Magic: The Gathering, Pokémon, and One Piece,
          with live market prices and value history — free.
        </p>
        <div className="rise-in mt-10 flex items-center gap-4 [animation-delay:240ms]">
          <Link
            href="/signup"
            className="control-label group rounded-md bg-brand px-6 py-3 text-brand-contrast hover:bg-brand-hover transition-colors"
          >
            Sign up{' '}
            <span aria-hidden="true" className="inline-block transition-transform duration-150 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <Link
            href="/login"
            className="control-label rounded-md border border-line bg-surface px-6 py-3 text-ink hover:border-ink transition-colors"
          >
            Log in
          </Link>
        </div>
      </section>

      {/* Feature showcases */}
      {showcases.map((s, i) => (
        <section key={s.index} className="grid items-center gap-8 border-t border-line py-16 md:grid-cols-2 md:gap-12">
          <div className={i % 2 === 1 ? 'md:order-last' : ''}>
            <span className="microlabel text-muted">{s.index} — {s.label}</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              {s.title}
            </h2>
            <p className="mt-3 text-muted">
              {s.description}
            </p>
          </div>
          {s.panel}
        </section>
      ))}

      {/* Closing CTA */}
      <section className="flex flex-col items-center border-t border-line py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          Start tracking your collection
        </h2>
        <p className="mt-3 max-w-md text-muted">
          Live prices, binders, and value history across three games — free.
        </p>
        <Link
          href="/signup"
          className="control-label group mt-8 rounded-md bg-brand px-6 py-3 text-brand-contrast hover:bg-brand-hover transition-colors"
        >
          Sign up{' '}
          <span aria-hidden="true" className="inline-block transition-transform duration-150 group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </section>
    </main>
  )
}

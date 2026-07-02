export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 py-4 text-center text-xs text-slate-500 dark:text-slate-500 shrink-0">
      <p>
        Card data and pricing courtesy of{' '}
        <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-300">
          Scryfall
        </a>{' '}
        (Magic: The Gathering),{' '}
        <a href="https://www.pokewallet.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-300">
          PokéWallet
        </a>{' '}
        (Pokémon), and{' '}
        <a href="https://optcgapi.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-300">
          OPTCG API
        </a>{' '}
        (One Piece). Binder is an independent, non-commercial tool and is not affiliated with or endorsed by Wizards of the Coast, The Pokémon Company, or Bandai.
      </p>
    </footer>
  )
}

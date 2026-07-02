export default function Footer() {
  return (
    <footer className="border-t bg-white px-6 py-4 text-center text-xs text-gray-500 shrink-0">
      <p>
        Card data and pricing courtesy of{' '}
        <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">
          Scryfall
        </a>{' '}
        (Magic: The Gathering),{' '}
        <a href="https://www.pokewallet.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">
          PokéWallet
        </a>{' '}
        (Pokémon), and{' '}
        <a href="https://optcgapi.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">
          OPTCG API
        </a>{' '}
        (One Piece). PokéBinder is an independent, non-commercial tool and is not
        affiliated with or endorsed by Wizards of the Coast, The Pokémon Company, or Bandai.
      </p>
    </footer>
  )
}

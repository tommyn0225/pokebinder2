// Shown by server pages when a Supabase query fails, so a DB error never
// masquerades as an empty collection ("$0.00 / 0 cards" / "No cards yet").
export default function DataErrorPanel() {
  return (
    <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-center py-16 px-6">
      <p className="font-semibold text-red-800 dark:text-red-300">Something went wrong loading your collection</p>
      <p className="text-sm text-red-700 dark:text-red-400 mt-1">
        Your data is safe — please try again shortly.
      </p>
    </div>
  )
}

export default function EmptyState({ message = "Aucune donnée pour cette combinaison de filtres." }: { message?: string }) {
  return (
    <div className="h-56 flex flex-col items-center justify-center text-center border border-dashed border-ink-200 rounded-md">
      <p className="text-sm text-ink-400 max-w-xs">{message}</p>
      <p className="text-xs text-ink-300 mt-1">Essayez d'élargir la période ou les villes sélectionnées.</p>
    </div>
  );
}

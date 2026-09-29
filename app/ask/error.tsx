"use client";

import { useEffect } from "react";

export default function AskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Ask AI:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto py-20">
      <div className="w-11 h-11 rounded-full bg-severity-4/15 ring-1 ring-severity-4/30 flex items-center justify-center text-severity-4 text-lg mb-4">
        !
      </div>
      <p className="font-display text-lg text-ink-950 mb-1.5">La page n&apos;a pas pu s&apos;afficher</p>
      <p className="text-sm text-ink-500 mb-6">
        Une erreur est survenue pendant le rendu. Réessayez, ou rechargez la page si le problème
        persiste.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-primary-500 text-ink-50 text-sm hover:bg-primary-400 transition-colors"
        >
          Réessayer
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg border border-ink-200 text-ink-500 text-sm hover:border-primary-500/50 hover:text-primary-300 transition-colors"
        >
          Recharger
        </button>
      </div>
      {error.digest && (
        <p className="mt-6 font-mono text-[10px] text-ink-300">référence {error.digest}</p>
      )}
    </div>
  );
}

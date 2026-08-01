"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/trends": "Trends",
  "/cities": "Cities",
  "/correlations": "Correlations",
  "/map": "Map",
  "/explorer": "Data Explorer",
  "/ask": "Ask AI",
  "/about": "About",
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/cities/")) return "City detail";
  return "AQI Warehouse";
}

export default function Topbar({ lastRefresh }: { lastRefresh: string | null }) {
  const pathname = usePathname();

  const formatted = lastRefresh
    ? new Date(lastRefresh).toLocaleString("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  return (
    <header className="sticky top-0 z-20 bg-ink-50/90 backdrop-blur border-b border-ink-200 px-4 md:px-8 py-4 flex items-center justify-between">
      <h1 className="font-display text-2xl pl-10 md:pl-0">{titleFor(pathname)}</h1>
      <div className="text-right font-mono text-[11px] text-ink-500">
        <div className="uppercase tracking-widest">Dernière collecte</div>
        <div className="text-ink-800">{formatted} UTC</div>
      </div>
    </header>
  );
}

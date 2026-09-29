"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Overview", icon: "◧" },
  { href: "/trends", label: "Trends", icon: "∿" },
  { href: "/cities", label: "Cities", icon: "▦" },
  { href: "/correlations", label: "Correlations", icon: "⤬" },
  { href: "/map", label: "Map", icon: "◎" },
  { href: "/explorer", label: "Data Explorer", icon: "▤" },
  { href: "/ask", label: "Ask AI", icon: "✦" },
  { href: "/architecture", label: "Architecture", icon: "⇄" },
  { href: "/about", label: "About", icon: "ⓘ" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-30 w-9 h-9 flex items-center justify-center border border-ink-200 bg-ink-100 text-ink-950 rounded-md"
        aria-label="Ouvrir la navigation"
      >
        <span className="text-lg leading-none">☰</span>
      </button>

      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:sticky top-0 h-screen w-64 shrink-0 border-r border-ink-200 bg-ink-50 z-40
          flex flex-col transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        `}
      >
        <div className="px-6 pt-7 pb-5 border-b border-ink-200">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl tracking-tight text-primary-400">AQI</span>
            <span className="font-mono text-[11px] text-ink-500 uppercase tracking-widest">
              Warehouse
            </span>
          </div>
          <div className="mt-1.5 h-[3px] w-16 flex overflow-hidden rounded-full">
            <div className="flex-1" style={{ backgroundColor: "#6b9080" }} />
            <div className="flex-1" style={{ backgroundColor: "#a4ac86" }} />
            <div className="flex-1" style={{ backgroundColor: "#e0b04a" }} />
            <div className="flex-1" style={{ backgroundColor: "#d1793d" }} />
            <div className="flex-1" style={{ backgroundColor: "#b3432b" }} />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
          <ul className="px-3 space-y-0.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
                    ${
                      isActive(item.href)
                        ? "bg-primary-500/15 text-primary-300 font-medium ring-1 ring-inset ring-primary-500/30"
                        : "text-ink-700 hover:bg-ink-100 hover:text-ink-950"
                    }
                  `}
                >
                  <span className="w-4 text-center text-[13px]">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-6 py-4 border-t border-ink-200 font-mono text-[10px] text-ink-400 uppercase tracking-wider">
          9 villes · Neon · GH Actions
        </div>
      </aside>
    </>
  );
}

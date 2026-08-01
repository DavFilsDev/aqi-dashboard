import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { getLastRefresh } from "@/lib/queries";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AQI Warehouse",
  description: "Qualité de l'air — pipeline de data engineering (star schema, Neon, GitHub Actions)",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lastRefresh = await getLastRefresh().catch(() => null);

  return (
    <html lang="fr" className={jetbrainsMono.variable}>
      <body className="font-body bg-ink-50 text-ink-950 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar lastRefresh={lastRefresh} />
            <main className="flex-1 px-4 md:px-8 py-6 max-w-[1400px] w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

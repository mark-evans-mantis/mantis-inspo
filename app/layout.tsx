import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Mantis Inspo Library",
  description: "Internal inspiration gallery",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f5f5f5] text-neutral-900">
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-[#f5f5f5]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
            <img src="/mantis-logo.svg" alt="Mantis logo" className="h-7 w-auto" />
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-600">
              Inspo Library
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}




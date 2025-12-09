import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mantis Inspo Library",
  description: "Internal inspiration library for Mantis",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f5f5f5] text-neutral-900">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-neutral-200 bg-[#f5f5f5]/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
              <img
                src="/mantis-logo.svg"
                alt="Mantis logo"
                className="h-7 w-auto"
              />
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-600">
                Inspo Library
              </span>
            </div>
          </header>

          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}


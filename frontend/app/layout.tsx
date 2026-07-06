import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Universal Video Downloader",
  description: "Download video dari YouTube, TikTok, Instagram, dan 1800+ situs lain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <div className="min-h-screen">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
            <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-lg font-bold text-slate-900">
                ⬇️ VidGrab
              </Link>
              <div className="flex gap-4 text-sm">
                <Link href="/" className="text-slate-600 hover:text-brand-dark">
                  Download
                </Link>
                <Link href="/supported" className="text-slate-600 hover:text-brand-dark">
                  Platform Didukung
                </Link>
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
          <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-slate-400">
            Gunakan hanya untuk konten milik sendiri atau berlisensi. Konten ber-DRM
            (Netflix, dll) tidak didukung.
          </footer>
        </div>
      </body>
    </html>
  );
}

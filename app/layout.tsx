import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "cwapa — AI video transcriber & downloader",
  description:
    "Paste a TikTok, YouTube, or Instagram link — or upload a file — and get a clean, timestamped transcript with AI summary. Download videos as MP4 or MP3.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col">
          <nav className="sticky top-0 z-10 border-b border-hairline/60 bg-white/80 backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                cwapa
              </Link>
              <div className="flex items-center gap-6 text-[14px]">
                <Link href="/tools" className="text-muted transition hover:text-ink">
                  Tools
                </Link>
                <Link href="/pricing" className="text-muted transition hover:text-ink">
                  Pricing
                </Link>
                <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted">
                  Beta
                </span>
              </div>
            </div>
          </nav>

          <div className="flex-1">{children}</div>

          <footer className="border-t border-hairline/60 py-8">
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 text-[12px] text-muted">
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
                <Link href="/tools/youtube-video-downloader" className="hover:text-ink">
                  YouTube Downloader
                </Link>
                <Link href="/tools/youtube-to-mp3" className="hover:text-ink">
                  YouTube to MP3
                </Link>
                <Link href="/tools/tiktok-video-downloader" className="hover:text-ink">
                  TikTok Downloader
                </Link>
                <Link href="/tools/tiktok-to-mp3" className="hover:text-ink">
                  TikTok to MP3
                </Link>
                <Link href="/tools/instagram-reels-downloader" className="hover:text-ink">
                  Reels Downloader
                </Link>
              </div>
              <p>cwapa — transcriber today, video agent tomorrow</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

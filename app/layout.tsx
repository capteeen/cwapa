import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";
import AccountNav from "@/components/AccountNav";
import BrandLogo from "@/components/BrandLogo";

const description =
  "Paste a TikTok, YouTube, or Instagram link — or upload a file — and get a clean, timestamped transcript with AI summary. Find and cut clips in plain English, and download videos as MP4 or MP3.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "cwapa — AI video transcriber, clip finder & downloader",
    template: "%s",
  },
  description,
  applicationName: SITE_NAME,
  openGraph: {
    title: "cwapa — AI video transcriber, clip finder & downloader",
    description,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "cwapa — AI video transcriber, clip finder & downloader",
    description,
  },
};

// Railway exposes service variables at runtime. Render this layout per request
// so browser-only SDK code receives the public account configuration even when
// the build environment does not include NEXT_PUBLIC_* values.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const publicConfig = JSON.stringify({
    insforgeUrl: process.env.NEXT_PUBLIC_INSFORGE_URL ?? "",
    insforgeAnonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? "",
  }).replace(/</g, "\\u003c");

  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: `window.__CWAPA_CONFIG__=${publicConfig}` }}
        />
      </head>
      <body>
        <div className="flex min-h-screen flex-col">
          <nav className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
            <div className="pointer-events-auto mx-auto flex max-w-5xl items-center justify-between rounded-full border border-white/35 bg-white/[.08] px-4 py-2.5 shadow-[0_16px_50px_-24px_rgba(12,18,28,.55)] backdrop-blur-2xl sm:px-5">
              <BrandLogo adaptive />
              <div className="flex items-center gap-3 text-[13px] sm:gap-6 sm:text-[14px]">
                <Link href="/studio" className="hidden text-white mix-blend-difference transition hover:opacity-70 md:block">
                  Caption Studio
                </Link>
                <Link href="/repurpose" className="hidden text-white mix-blend-difference transition hover:opacity-70 sm:block">
                  Repurpose
                </Link>
                <Link href="/tools" className="hidden text-white mix-blend-difference transition hover:opacity-70 sm:block">
                  Tools
                </Link>
                <Link href="/pricing" className="text-white mix-blend-difference transition hover:opacity-70">
                  Pricing
                </Link>
                <AccountNav />
              </div>
            </div>
          </nav>

          <div className="flex-1">{children}</div>

          <footer className="border-t border-hairline/60 bg-white py-10">
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-[12px] text-muted">
              <BrandLogo />
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
              <p>From source to story, without leaving the flow.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

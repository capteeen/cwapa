import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/800.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/700.css";
import "@fontsource/open-sans/800.css";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import "@fontsource/comic-neue/400.css";
import "@fontsource/comic-neue/700.css";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";
import BrandLogo from "@/components/BrandLogo";
import SiteNav from "@/components/SiteNav";

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
          <SiteNav />

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

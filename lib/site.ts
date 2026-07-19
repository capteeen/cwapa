// Canonical site URL for metadata, sitemap, and Open Graph tags.
// Set NEXT_PUBLIC_SITE_URL in the environment to your real domain.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://cwapa-production.up.railway.app"
).replace(/\/$/, "");

export const SITE_NAME = "cwapa";
export const SITE_TAGLINE = "AI video transcriber, clip finder & downloader";

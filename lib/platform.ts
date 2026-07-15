export type Platform = "youtube" | "tiktok" | "instagram";

const PATTERNS: Record<Platform, RegExp[]> = {
  youtube: [
    /^https?:\/\/(www\.|m\.|music\.)?youtube\.com\/(watch\?|shorts\/|live\/|embed\/)/i,
    /^https?:\/\/youtu\.be\/[\w-]{6,}/i,
  ],
  tiktok: [
    /^https?:\/\/(www\.|m\.)?tiktok\.com\/(@[\w.-]+\/(video|photo)\/\d+|t\/[\w-]+)/i,
    /^https?:\/\/(vm|vt)\.tiktok\.com\/[\w-]+/i,
  ],
  instagram: [
    /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p|tv)\/[\w-]+/i,
    /^https?:\/\/(www\.)?instagram\.com\/[\w.]+\/(reel|p)\/[\w-]+/i,
  ],
};

export function detectPlatform(url: string): Platform | null {
  for (const [platform, regexes] of Object.entries(PATTERNS)) {
    if (regexes.some((re) => re.test(url.trim()))) {
      return platform as Platform;
    }
  }
  return null;
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

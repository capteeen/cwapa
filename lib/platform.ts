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

export function getYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    let id: string | null = null;

    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (host === "youtube.com" || host === "music.youtube.com") {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else id = url.pathname.split("/").filter(Boolean)[1] ?? null;
    }

    return id && /^[\w-]{6,}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

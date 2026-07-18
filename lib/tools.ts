export interface ToolPage {
  slug: string;
  name: string;
  heading: string;
  sub: string;
  defaultFormat: string;
  metaTitle: string;
  metaDescription: string;
}

export const TOOL_PAGES: ToolPage[] = [
  {
    slug: "youtube-video-downloader",
    name: "YouTube Video Downloader",
    heading: "Download YouTube videos.",
    sub: "Save any YouTube video as MP4 in up to full HD — fast, free, no ads.",
    defaultFormat: "best",
    metaTitle: "Free YouTube Video Downloader — MP4 in HD | cwapa",
    metaDescription:
      "Download YouTube videos as MP4 in the quality you choose, or extract the audio as MP3. Free, fast, and no watermarks.",
  },
  {
    slug: "youtube-to-mp3",
    name: "YouTube to MP3",
    heading: "YouTube to MP3.",
    sub: "Extract the audio from any YouTube video as a clean 192k MP3.",
    defaultFormat: "mp3",
    metaTitle: "YouTube to MP3 Converter — Free & Fast | cwapa",
    metaDescription:
      "Convert YouTube videos to MP3 audio online. Paste a link, get a high-quality MP3 — free and instant.",
  },
  {
    slug: "youtube-transcript-generator",
    name: "YouTube Transcript Generator",
    heading: "YouTube videos, transcribed.",
    sub: "Paste a YouTube link and get an accurate, timestamped transcript with AI summary.",
    defaultFormat: "best",
    metaTitle: "YouTube Transcript Generator — AI Transcription | cwapa",
    metaDescription:
      "Generate accurate, timestamped transcripts from YouTube videos with Whisper AI. Export as text or SRT subtitles.",
  },
  {
    slug: "tiktok-video-downloader",
    name: "TikTok Video Downloader",
    heading: "Download TikTok videos.",
    sub: "Save TikTok videos in their original quality as MP4.",
    defaultFormat: "best",
    metaTitle: "Free TikTok Video Downloader — MP4 | cwapa",
    metaDescription:
      "Download TikTok videos as MP4 in original quality, or grab the audio as MP3. Free and fast.",
  },
  {
    slug: "tiktok-to-mp3",
    name: "TikTok to MP3",
    heading: "TikTok to MP3.",
    sub: "Pull the sound from any TikTok as a high-quality MP3.",
    defaultFormat: "mp3",
    metaTitle: "TikTok to MP3 Converter — Free | cwapa",
    metaDescription:
      "Convert TikTok videos to MP3 audio online. Paste a TikTok link and download the sound in seconds.",
  },
  {
    slug: "tiktok-transcript-generator",
    name: "TikTok Transcript Generator",
    heading: "TikTok videos, transcribed.",
    sub: "Turn any TikTok into accurate, timestamped text with AI summary.",
    defaultFormat: "best",
    metaTitle: "TikTok Transcript Generator — AI Transcription | cwapa",
    metaDescription:
      "Generate transcripts from TikTok videos with Whisper AI. Timestamped text, SRT export, and instant summaries.",
  },
  {
    slug: "instagram-reels-downloader",
    name: "Instagram Reels Downloader",
    heading: "Download Instagram Reels.",
    sub: "Save Reels and Instagram videos as MP4, or just the audio as MP3.",
    defaultFormat: "best",
    metaTitle: "Instagram Reels Downloader — MP4 | cwapa",
    metaDescription:
      "Download Instagram Reels and videos as MP4, or extract MP3 audio. Free and fast.",
  },
  {
    slug: "instagram-transcript-generator",
    name: "Instagram Transcript Generator",
    heading: "Instagram Reels, transcribed.",
    sub: "Accurate, timestamped transcripts for Reels and Instagram videos.",
    defaultFormat: "best",
    metaTitle: "Instagram Transcript Generator — AI Transcription | cwapa",
    metaDescription:
      "Generate transcripts from Instagram Reels with Whisper AI. Timestamped text, subtitles, and summaries.",
  },
];

export function getToolPage(slug: string): ToolPage | undefined {
  return TOOL_PAGES.find((t) => t.slug === slug);
}

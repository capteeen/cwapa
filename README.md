# cwapa

**cwapa** transcribes TikTok, YouTube, and Instagram videos. Paste a link, get a clean, timestamped transcript, then edit, style, and burn captions into the video.

> Transcriber today, video agent tomorrow — this is the first building block.

## How it works

1. You paste a video URL; the platform is auto-detected.
2. The server uses **yt-dlp** to fetch the video's metadata and extract a small mono MP3 of the audio (ffmpeg).
3. The audio is transcribed with **OpenAI Whisper** (timestamped segments).
4. If no `OPENAI_API_KEY` is set, YouTube videos fall back to their own captions — TikTok/Instagram need the key.

## Requirements

- Node.js 18+ (22 recommended)
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) on the PATH (or set `YT_DLP_PATH`)
- [`ffmpeg`](https://ffmpeg.org/) on the PATH
- An OpenAI API key (for Whisper)

## Quick start

```bash
# install yt-dlp + ffmpeg (examples)
#   macOS:  brew install yt-dlp ffmpeg
#   Debian: sudo apt install ffmpeg && pip install yt-dlp

npm install
cp .env.example .env   # add your OPENAI_API_KEY
npm run dev            # http://localhost:3000
```

## Docker

The Dockerfile bundles yt-dlp and ffmpeg, so this is the easiest way to deploy (Railway, Render, Fly.io, a VPS — anywhere that runs containers; Vercel's serverless runtime won't work because yt-dlp/ffmpeg binaries are needed):

```bash
docker build -t cwapa .
docker run -p 3000:3000 -e OPENAI_API_KEY=sk-... cwapa
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | API key for the Whisper provider (required for TikTok/Instagram) |
| `WHISPER_API_URL` | OpenAI's endpoint | Any OpenAI-compatible transcription endpoint (e.g. Groq) |
| `WHISPER_MODEL` | `whisper-1` (`whisper-large-v3-turbo` on Groq) | Whisper model name |
| `LLM_API_URL` | Provider chat-completions endpoint | Optional OpenAI-compatible endpoint used for summaries, moment search, and translation |
| `LLM_MODEL` | `gpt-4o-mini` (OpenAI) or `llama-3.3-70b-versatile` (Groq) | Model used for AI text features |
| `YT_DLP_PATH` | `yt-dlp` | Path to the yt-dlp binary |
| `FFMPEG_PATH` | `ffmpeg` | Path to the ffmpeg binary |
| `MAX_VIDEO_SECONDS` | `3600` | Reject videos longer than this |
| `YT_DLP_COOKIES` | — | Cookies file for Instagram / age-gated content |
| `YT_DLP_COOKIES_B64` | — | Same as above but base64 content (for Railway-style hosts) |

### Free transcription with Groq

Don't want to pay OpenAI? [Groq](https://console.groq.com) hosts Whisper with a generous free tier and an OpenAI-compatible API. Create a key at https://console.groq.com/keys, then set:

```
OPENAI_API_KEY=gsk_your_groq_key
WHISPER_API_URL=https://api.groq.com/openai/v1/audio/transcriptions
```

### A note on Instagram

Instagram frequently requires a logged-in session to download media. If Instagram links fail, export your browser cookies to a file (e.g. with a "Get cookies.txt" extension) and set `YT_DLP_COOKIES` to its path.

## Downloading videos

Next to the Transcribe button there's a **Download MP4** button that saves the video itself. Under the hood it's `GET /api/download?url=...`, which streams a progressive MP4 (on YouTube this tops out around 720p — higher resolutions require merging separate video/audio tracks, which can't be streamed).

## API

`POST /api/transcribe` with `{ "url": "https://..." }` returns:

```json
{
  "platform": "youtube",
  "meta": { "title": "...", "uploader": "...", "durationSeconds": 123, "thumbnail": "..." },
  "transcript": { "text": "...", "language": "english", "segments": [{ "start": 0, "end": 4.2, "text": "..." }] },
  "source": "whisper"
}
```

## Roadmap

- [x] URL → transcript for TikTok / YouTube / Instagram
- [ ] Summaries, chapters & content repurposing (the "video agent")
- [ ] Batch transcription & history
- [ ] Speaker labels
- [x] Transcript translation (10 languages)
- [x] Subtitle & Caption Studio with SRT, VTT, and hard-burned MP4 export

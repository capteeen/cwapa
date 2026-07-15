import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const YT_DLP = process.env.YT_DLP_PATH || "yt-dlp";
const MAX_DURATION_SECONDS = Number(process.env.MAX_VIDEO_SECONDS || 3600);

export interface VideoMeta {
  id: string;
  title: string;
  uploader: string;
  durationSeconds: number;
  thumbnail: string | null;
  webpageUrl: string;
}

export class TranscribeError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

function commonArgs(): string[] {
  const args = ["--no-playlist", "--no-warnings"];
  // Optional cookies file for Instagram (often requires login) or age-gated content.
  if (process.env.YT_DLP_COOKIES) {
    args.push("--cookies", process.env.YT_DLP_COOKIES);
  }
  return args;
}

function explainYtDlpFailure(stderr: string): TranscribeError {
  const s = stderr.toLowerCase();
  if (s.includes("login required") || s.includes("rate-limit") || s.includes("requested content is not available")) {
    return new TranscribeError(
      "This video requires a login to access (common for Instagram). Configure YT_DLP_COOKIES with a cookies file to transcribe it.",
      422
    );
  }
  if (s.includes("private") || s.includes("this video is unavailable") || s.includes("404")) {
    return new TranscribeError("The video is private, deleted, or unavailable.", 422);
  }
  if (s.includes("unsupported url")) {
    return new TranscribeError("This URL is not supported.", 422);
  }
  const firstError = stderr.split("\n").find((l) => l.startsWith("ERROR:"));
  return new TranscribeError(firstError ? firstError.replace(/^ERROR:\s*/, "") : "Failed to fetch the video.", 502);
}

export async function fetchMeta(url: string): Promise<VideoMeta> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      YT_DLP,
      [...commonArgs(), "--dump-json", "--skip-download", url],
      { maxBuffer: 64 * 1024 * 1024, timeout: 120_000 }
    ));
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new TranscribeError("yt-dlp is not installed on the server. See README for setup.", 500);
    }
    throw explainYtDlpFailure(String(err?.stderr || err?.message || ""));
  }

  const info = JSON.parse(stdout);
  const duration = Math.round(Number(info.duration) || 0);
  if (duration > MAX_DURATION_SECONDS) {
    throw new TranscribeError(
      `Video is ${Math.round(duration / 60)} min long — the limit is ${Math.round(MAX_DURATION_SECONDS / 60)} min.`,
      422
    );
  }
  return {
    id: String(info.id ?? ""),
    title: String(info.title ?? "Untitled"),
    uploader: String(info.uploader ?? info.channel ?? info.uploader_id ?? "Unknown"),
    durationSeconds: duration,
    thumbnail: typeof info.thumbnail === "string" ? info.thumbnail : null,
    webpageUrl: String(info.webpage_url ?? ""),
  };
}

/**
 * Downloads the audio track as a small mono mp3 suitable for the Whisper API
 * (25 MB limit). Returns the file buffer; cleans up temp files itself.
 */
export async function downloadAudio(url: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "cwapa-"));
  try {
    await execFileAsync(
      YT_DLP,
      [
        ...commonArgs(),
        "-x",
        "--audio-format",
        "mp3",
        "--postprocessor-args",
        "ffmpeg:-ac 1 -ar 16000 -b:a 32k",
        "-o",
        path.join(dir, "audio.%(ext)s"),
        url,
      ],
      { maxBuffer: 16 * 1024 * 1024, timeout: 600_000 }
    );
    const files = await readdir(dir);
    const audioFile = files.find((f) => f.startsWith("audio."));
    if (!audioFile) {
      throw new TranscribeError("Audio extraction produced no file (is ffmpeg installed?).", 500);
    }
    return await readFile(path.join(dir, audioFile));
  } catch (err: any) {
    if (err instanceof TranscribeError) throw err;
    if (err?.code === "ENOENT") {
      throw new TranscribeError("yt-dlp is not installed on the server. See README for setup.", 500);
    }
    throw explainYtDlpFailure(String(err?.stderr || err?.message || ""));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Fallback when no OPENAI_API_KEY is configured: pull YouTube's own
 * (auto-)captions. Returns null when no captions exist.
 */
export async function fetchYoutubeCaptions(
  url: string
): Promise<{ segments: { start: number; end: number; text: string }[] } | null> {
  const dir = await mkdtemp(path.join(tmpdir(), "cwapa-subs-"));
  try {
    await execFileAsync(
      YT_DLP,
      [
        ...commonArgs(),
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        "en.*,en",
        "--sub-format",
        "json3",
        "-o",
        path.join(dir, "subs"),
        url,
      ],
      { maxBuffer: 16 * 1024 * 1024, timeout: 120_000 }
    );
    const files = await readdir(dir);
    const subFile = files.find((f) => f.endsWith(".json3"));
    if (!subFile) return null;

    const raw = JSON.parse(await readFile(path.join(dir, subFile), "utf8"));
    const segments: { start: number; end: number; text: string }[] = [];
    for (const event of raw.events ?? []) {
      if (!event.segs) continue;
      const text = event.segs
        .map((s: { utf8?: string }) => s.utf8 ?? "")
        .join("")
        .replace(/\n/g, " ")
        .trim();
      if (!text) continue;
      const start = (event.tStartMs ?? 0) / 1000;
      segments.push({
        start,
        end: start + (event.dDurationMs ?? 0) / 1000,
        text,
      });
    }
    return segments.length > 0 ? { segments } : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

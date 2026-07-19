import { execFile } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { detectPlatform } from "./platform";
import { notifyCookieIssue } from "./alert";
import { recordProxyBytes } from "./usage";

const execFileAsync = promisify(execFile);

export const YT_DLP = process.env.YT_DLP_PATH || "yt-dlp";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
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

let cookiesPath: string | null | undefined;
let cookiesUpdatedAt: number | null = null;

/**
 * The writable cookie store. yt-dlp is given this path for both reading AND
 * writing, so the refreshed session cookies it receives on each successful
 * request are written back here — extending cookie life automatically.
 * Point COOKIES_STORE_PATH at a Railway volume (e.g. /data/cookies.txt) to
 * make that renewal survive restarts; otherwise it lives in /tmp for the
 * lifetime of the deploy.
 */
function storePath(): string {
  return process.env.COOKIES_STORE_PATH || path.join(tmpdir(), "cwapa-cookies.txt");
}

function seedFromEnv(dest: string): boolean {
  if (process.env.YT_DLP_COOKIES_CONTENT) {
    writeFileSync(dest, process.env.YT_DLP_COOKIES_CONTENT);
    return true;
  }
  if (process.env.YT_DLP_COOKIES_B64) {
    writeFileSync(dest, Buffer.from(process.env.YT_DLP_COOKIES_B64, "base64"));
    return true;
  }
  return false;
}

/**
 * Cookies can come as an external file path (YT_DLP_COOKIES, read-only), or be
 * materialized into the writable store from env content, or be uploaded at
 * runtime via saveCookies().
 */
function resolveCookies(): string | null {
  if (cookiesPath !== undefined) return cookiesPath;

  // An explicit external file wins and is used read-only.
  if (process.env.YT_DLP_COOKIES) {
    cookiesPath = process.env.YT_DLP_COOKIES;
    return cookiesPath;
  }

  const store = storePath();
  try {
    if (existsSync(store) && statSync(store).size > 0) {
      cookiesPath = store;
      return cookiesPath;
    }
    mkdirSync(path.dirname(store), { recursive: true });
    if (seedFromEnv(store)) {
      cookiesPath = store;
      return cookiesPath;
    }
  } catch {
    /* fall through to no-cookies */
  }
  cookiesPath = null;
  return cookiesPath;
}

/** Replace the cookie store at runtime (used by the admin endpoint). */
export function saveCookies(content: string): void {
  const store = storePath();
  mkdirSync(path.dirname(store), { recursive: true });
  writeFileSync(store, content);
  cookiesPath = store;
  cookiesUpdatedAt = Date.now();
}

export function cookiesStatus(): { configured: boolean; updatedAt: number | null } {
  return { configured: resolveCookies() !== null, updatedAt: cookiesUpdatedAt };
}

/**
 * YouTube plays whack-a-mole with datacenter IPs: web clients hit the
 * "confirm you're not a bot" wall, TV clients sometimes get served only
 * DRM-flagged formats. Different player clients fail differently, so we
 * rotate through these sets until one yields usable formats.
 * formats=missing_pot admits formats YouTube withholds PO tokens for.
 */
export const YT_CLIENT_SETS = [
  "youtube:player_client=tv_simply,web_safari;formats=missing_pot",
  "youtube:player_client=android_vr;formats=missing_pot",
  "youtube:player_client=web,tv;formats=missing_pot",
];

export function shouldRotateClient(stderr: string): boolean {
  const s = stderr.toLowerCase();
  return (
    s.includes("drm") ||
    s.includes("sign in to confirm") ||
    s.includes("not a bot") ||
    s.includes("po token") ||
    s.includes("requested format is not available") ||
    s.includes("403")
  );
}

export function commonArgs(
  url?: string,
  clientSet = 0,
  opts: { skipProxy?: boolean } = {}
): string[] {
  const args = ["--no-playlist", "--no-warnings"];
  // Route through a (residential) proxy so requests look like ordinary home
  // traffic — sidesteps YouTube's datacenter-IP blocking. Works with any
  // http/https/socks5 proxy string, e.g. IPRoyal:
  //   http://user:pass@geo.iproyal.com:12321
  const proxy = process.env.YT_DLP_PROXY;
  if (proxy && !opts.skipProxy) {
    args.push("--proxy", proxy);
  }
  const cookies = resolveCookies();
  if (url && detectPlatform(url) === "youtube") {
    // Account cookies authenticate yt-dlp's default (web) clients, so with
    // cookies configured attempt 0 skips the client disguises entirely.
    const idx = cookies ? clientSet - 1 : clientSet;
    if (idx >= 0) {
      args.push("--extractor-args", YT_CLIENT_SETS[Math.min(idx, YT_CLIENT_SETS.length - 1)]);
    }
  }
  if (cookies) {
    args.push("--cookies", cookies);
  }
  return args;
}

/**
 * Runs yt-dlp, rotating through YouTube player-client sets when a failure
 * looks client-specific (DRM poisoning, bot checks, missing formats).
 */
export async function execYtDlp(
  url: string,
  extraArgs: string[],
  opts: { maxBuffer: number; timeout: number; skipProxy?: boolean }
): Promise<{ stdout: string; stderr: string }> {
  const attempts =
    detectPlatform(url) === "youtube"
      ? YT_CLIENT_SETS.length + (resolveCookies() ? 1 : 0)
      : 1;
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await execFileAsync(
        YT_DLP,
        [...commonArgs(url, i, { skipProxy: opts.skipProxy }), ...extraArgs, url],
        opts
      );
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        throw new TranscribeError("yt-dlp is not installed on the server. See README for setup.", 500);
      }
      lastErr = err;
      if (i + 1 < attempts && shouldRotateClient(String(err?.stderr ?? ""))) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export function explainYtDlpFailure(stderr: string): TranscribeError {
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
  if (s.includes("requested format is not available")) {
    notifyCookieIssue("no usable formats offered");
    return new TranscribeError(
      "YouTube didn't offer any usable media formats to this server (anti-bot measure). Adding browser cookies via YT_DLP_COOKIES_CONTENT usually fixes this.",
      502
    );
  }
  if (s.includes("drm")) {
    notifyCookieIssue("DRM-only formats served");
    return new TranscribeError(
      "YouTube is serving this video in a locked (DRM) form to this server — an anti-bot measure, tried multiple workarounds. Adding browser cookies via YT_DLP_COOKIES_CONTENT usually resolves it.",
      502
    );
  }
  if (s.includes("sign in to confirm") || s.includes("not a bot") || s.includes("403")) {
    notifyCookieIssue("bot check / sign-in wall");
    return new TranscribeError(
      "The platform is blocking downloads from this server's IP (bot check). Add exported browser cookies via the YT_DLP_COOKIES_CONTENT environment variable to get past it.",
      502
    );
  }
  const firstError = stderr.split("\n").find((l) => l.startsWith("ERROR:"));
  return new TranscribeError(firstError ? firstError.replace(/^ERROR:\s*/, "") : "Failed to fetch the video.", 502);
}

export async function fetchMeta(url: string): Promise<VideoMeta> {
  let stdout: string;
  try {
    ({ stdout } = await execYtDlp(url, ["--dump-json", "--skip-download"], {
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    }));
  } catch (err: any) {
    if (err instanceof TranscribeError) throw err;
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
 * Downloads the media, then converts it to a small mono mp3 suitable for the
 * Whisper API (25 MB limit) with a direct ffmpeg call. We deliberately avoid
 * yt-dlp's --extract-audio postprocessor: its codec sniffing chokes on some
 * TikTok/Instagram files ("unable to obtain file audio codec with ffprobe")
 * that ffmpeg itself converts fine.
 */
export async function downloadAudio(url: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "cwapa-"));
  try {
    try {
      // Grab the SMALLEST audio-only stream. Whisper resamples to 16 kHz mono
      // regardless, so low-bitrate audio loses no accuracy — and it slashes
      // proxy bandwidth vs. pulling the full video just to strip its audio.
      // Fallbacks: worst audio → any audio → best (rare: combined-only posts).
      await execYtDlp(
        url,
        ["-f", "worstaudio/bestaudio/best", "-o", path.join(dir, "source.%(ext)s")],
        { maxBuffer: 16 * 1024 * 1024, timeout: 600_000 }
      );
    } catch (err: any) {
      if (err instanceof TranscribeError) throw err;
      throw explainYtDlpFailure(String(err?.stderr || err?.message || ""));
    }

    // Pick the largest downloaded file (photo posts can produce several).
    const files = await readdir(dir);
    let sourcePath: string | null = null;
    let sourceSize = 0;
    for (const f of files) {
      const size = (await stat(path.join(dir, f))).size;
      if (size > sourceSize) {
        sourceSize = size;
        sourcePath = path.join(dir, f);
      }
    }
    if (!sourcePath || sourceSize === 0) {
      throw new TranscribeError("The download produced no media file.", 502);
    }
    recordProxyBytes(sourceSize); // transcription audio always goes via proxy

    // If the "media" is actually an HTML/JSON error page, the platform blocked
    // the download (common for datacenter IPs). Fail with a useful message.
    const head = (await readFile(sourcePath)).subarray(0, 256).toString("utf8").trimStart();
    if (head.startsWith("<") || head.startsWith("{")) {
      throw new TranscribeError(
        "The platform refused to serve the video to this server (IP blocking). Try again, or configure YT_DLP_COOKIES.",
        502
      );
    }

    const outPath = path.join(dir, "out.mp3");
    try {
      await execFileAsync(
        FFMPEG,
        ["-y", "-i", sourcePath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", outPath],
        { maxBuffer: 16 * 1024 * 1024, timeout: 600_000 }
      );
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        throw new TranscribeError("ffmpeg is not installed on the server. See README for setup.", 500);
      }
      throw new TranscribeError(
        "Could not extract an audio track from this post. If it's a TikTok photo/slideshow, it may have no speech to transcribe.",
        422
      );
    }
    return await readFile(outPath);
  } catch (err: any) {
    if (err instanceof TranscribeError) throw err;
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
    await execYtDlp(
      url,
      [
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        "en.*,en",
        "--sub-format",
        "json3",
        "-o",
        path.join(dir, "subs"),
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

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { detectPlatform } from "@/lib/platform";
import { guard } from "@/lib/ratelimit";
import { downloadStudioVideo } from "@/lib/video";
import { TranscribeError } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const PREVIEW_TTL_MS = 15 * 60 * 1000;

interface CachedPreview {
  directory: string;
  filePath: string;
  size: number;
  expiresAt: number;
}

const previewCache = new Map<string, CachedPreview>();
const pendingPreviews = new Map<string, Promise<CachedPreview>>();

function previewKey(url: string) {
  return createHash("sha256").update(url).digest("hex");
}

async function sweepExpiredPreviews() {
  const now = Date.now();
  await Promise.all(
    [...previewCache.entries()].map(async ([key, preview]) => {
      if (preview.expiresAt > now) return;
      previewCache.delete(key);
      await rm(preview.directory, { recursive: true, force: true }).catch(() => {});
    })
  );
}

async function preparePreview(url: string): Promise<CachedPreview> {
  const key = previewKey(url);
  const cached = previewCache.get(key);
  if (cached?.expiresAt && cached.expiresAt > Date.now()) {
    try {
      await stat(cached.filePath);
      return cached;
    } catch {
      previewCache.delete(key);
    }
  }

  const pending = pendingPreviews.get(key);
  if (pending) return pending;

  const preparation = (async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "cwapa-preview-"));
    try {
      const downloadedPath = await downloadStudioVideo(url, directory, 720);
      const filePath = path.join(directory, "preview.mp4");

      // MP4 is only a container: YouTube may put AV1/VP9 inside it, which Safari
      // cannot decode. H.264/AAC plus fast-start is supported across browsers.
      try {
        await execFileAsync(
          FFMPEG,
          [
            "-y",
            "-i",
            downloadedPath,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            filePath,
          ],
          { maxBuffer: 32 * 1024 * 1024, timeout: 900_000 }
        );
      } catch (error: any) {
        if (error?.code === "ENOENT") {
          throw new TranscribeError("ffmpeg is not installed on the server.", 500);
        }
        console.error("studio preview ffmpeg error:", String(error?.stderr ?? error));
        throw new TranscribeError(
          "The video preview could not be converted for browser playback.",
          502
        );
      }

      const preview = {
        directory,
        filePath,
        size: (await stat(filePath)).size,
        expiresAt: Date.now() + PREVIEW_TTL_MS,
      };
      previewCache.set(key, preview);
      return preview;
    } catch (error) {
      await rm(directory, { recursive: true, force: true }).catch(() => {});
      throw error;
    } finally {
      pendingPreviews.delete(key);
    }
  })();

  pendingPreviews.set(key, preparation);
  return preparation;
}

function parseRange(header: string | null, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return undefined;

  let start: number;
  let end: number;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return undefined;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    return undefined;
  }
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(req: NextRequest) {
  const url = (req.nextUrl.searchParams.get("url") ?? "").trim();
  if (!detectPlatform(url)) {
    return NextResponse.json({ error: "Provide a supported video URL." }, { status: 422 });
  }

  const key = previewKey(url);
  const cached = previewCache.get(key);
  if ((!cached || cached.expiresAt <= Date.now()) && !pendingPreviews.has(key)) {
    const limited = guard(req, { heavy: true });
    if (limited) return limited;
  }

  void sweepExpiredPreviews();
  try {
    const preview = await preparePreview(url);
    const range = parseRange(req.headers.get("range"), preview.size);
    if (range === undefined) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${preview.size}` },
      });
    }

    const start = range?.start ?? 0;
    const end = range?.end ?? preview.size - 1;
    const source = createReadStream(preview.filePath, { start, end });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        source.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
        source.on("end", () => controller.close());
        source.on("error", (error) => controller.error(error));
      },
      cancel() {
        source.destroy();
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "video/mp4",
      "Content-Length": String(end - start + 1),
      "Content-Disposition": 'inline; filename="cwapa-preview.mp4"',
      "Cache-Control": "private, max-age=900",
      "Accept-Ranges": "bytes",
    };
    if (range) headers["Content-Range"] = `bytes ${start}-${end}/${preview.size}`;

    return new Response(stream, { status: range ? 206 : 200, headers });
  } catch (error) {
    if (error instanceof TranscribeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("studio preview failed:", error);
    return NextResponse.json({ error: "Could not prepare the video preview." }, { status: 500 });
  }
}

import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { detectPlatform } from "@/lib/platform";
import {
  TranscribeError,
  execYtDlp,
  explainYtDlpFailure,
  fetchMeta,
} from "@/lib/ytdlp";

export const runtime = "nodejs";
export const maxDuration = 300;

import { guard } from "@/lib/ratelimit";

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

// Prefer an mp4/m4a merge, fall back to any best video+audio, then any best.
// Downloading to a file (rather than streaming yt-dlp's stdout) lets ffmpeg
// merge separate video/audio tracks, which many YouTube formats require.
function videoFormat(maxHeight: number | null): string {
  if (!maxHeight) return "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b";
  const h = `[height<=${maxHeight}]`;
  return `bv*${h}[ext=mp4]+ba[ext=m4a]/bv*${h}+ba/b${h}/b`;
}

const QUALITIES: Record<string, number | null> = {
  best: null,
  "1080": 1080,
  "720": 720,
  "480": 480,
};

export async function GET(req: NextRequest) {
  const limited = guard(req, { heavy: true });
  if (limited) return limited;

  const url = (req.nextUrl.searchParams.get("url") ?? "").trim();
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter." }, { status: 400 });
  }
  const platform = detectPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: "That doesn't look like a TikTok, YouTube, or Instagram video URL." },
      { status: 422 }
    );
  }

  const format = req.nextUrl.searchParams.get("format") ?? "best";
  if (format !== "mp3" && !(format in QUALITIES)) {
    return NextResponse.json(
      { error: "format must be one of: best, 1080, 720, 480, mp3" },
      { status: 422 }
    );
  }

  const dir = await mkdtemp(path.join(tmpdir(), "cwapa-dl-"));
  const cleanup = () => rm(dir, { recursive: true, force: true }).catch(() => {});
  try {
    const meta = await fetchMeta(url);
    const safeName =
      meta.title.replace(/[^\w\d -]+/g, "").trim().slice(0, 60) || "cwapa-video";

    let filePath: string;
    let contentType: string;
    let filename: string;

    if (format === "mp3") {
      // Grab whatever media exists, then let ffmpeg pull a listening-quality
      // mp3 out of it.
      await execYtDlp(url, ["-o", path.join(dir, "source.%(ext)s")], {
        maxBuffer: 16 * 1024 * 1024,
        timeout: 600_000,
      });
      const files = await readdir(dir);
      let source: string | null = null;
      let sourceSize = 0;
      for (const f of files) {
        const s = (await stat(path.join(dir, f))).size;
        if (s > sourceSize) {
          sourceSize = s;
          source = path.join(dir, f);
        }
      }
      if (!source) {
        await cleanup();
        return NextResponse.json({ error: "Download produced no file." }, { status: 502 });
      }
      filePath = path.join(dir, "audio.mp3");
      await execFileAsync(
        FFMPEG,
        ["-y", "-i", source, "-vn", "-b:a", "192k", filePath],
        { maxBuffer: 16 * 1024 * 1024, timeout: 600_000 }
      );
      contentType = "audio/mpeg";
      filename = `${safeName}.mp3`;
    } else {
      await execYtDlp(
        url,
        [
          "-f",
          videoFormat(QUALITIES[format]),
          "--merge-output-format",
          "mp4",
          "-o",
          path.join(dir, "video.%(ext)s"),
        ],
        { maxBuffer: 16 * 1024 * 1024, timeout: 600_000 }
      );
      const files = await readdir(dir);
      const file = files.find((f) => f.startsWith("video."));
      if (!file) {
        await cleanup();
        return NextResponse.json({ error: "Download produced no file." }, { status: 502 });
      }
      filePath = path.join(dir, file);
      contentType = "video/mp4";
      filename = `${safeName}.mp4`;
    }

    const size = (await stat(filePath)).size;

    const rs = createReadStream(filePath);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        rs.on("data", (d) => controller.enqueue(new Uint8Array(d as Buffer)));
        rs.on("end", () => {
          controller.close();
          void cleanup();
        });
        rs.on("error", (e) => {
          controller.error(e);
          void cleanup();
        });
      },
      cancel() {
        rs.destroy();
        void cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    await cleanup();
    if (err instanceof TranscribeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json(
        { error: "yt-dlp is not installed on the server." },
        { status: 500 }
      );
    }
    const explained = explainYtDlpFailure(String(err?.stderr || err?.message || ""));
    return NextResponse.json({ error: explained.message }, { status: explained.status });
  }
}

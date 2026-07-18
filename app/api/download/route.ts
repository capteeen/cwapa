import { createReadStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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

// Prefer an mp4/m4a merge, fall back to any best video+audio, then any best.
// Downloading to a file (rather than streaming yt-dlp's stdout) lets ffmpeg
// merge separate video/audio tracks, which many YouTube formats require.
const FORMAT = "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b";

export async function GET(req: NextRequest) {
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

  const dir = await mkdtemp(path.join(tmpdir(), "cwapa-dl-"));
  const cleanup = () => rm(dir, { recursive: true, force: true }).catch(() => {});
  try {
    const meta = await fetchMeta(url);
    const safeName =
      meta.title.replace(/[^\w\d -]+/g, "").trim().slice(0, 60) || "cwapa-video";

    await execYtDlp(
      url,
      [
        "-f",
        FORMAT,
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
    const filePath = path.join(dir, file);
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
        "Content-Type": "video/mp4",
        "Content-Length": String(size),
        "Content-Disposition": `attachment; filename="${safeName}.mp4"`,
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

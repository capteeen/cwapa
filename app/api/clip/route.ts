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
import { guard } from "@/lib/ratelimit";
import { recordProxyBytes } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

function num(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function GET(req: NextRequest) {
  const limited = guard(req, { heavy: true });
  if (limited) return limited;

  const url = (req.nextUrl.searchParams.get("url") ?? "").trim();
  const start = num(req.nextUrl.searchParams.get("start"));
  const end = num(req.nextUrl.searchParams.get("end"));
  const format = req.nextUrl.searchParams.get("format") === "mp3" ? "mp3" : "mp4";

  if (!url || start === null || end === null || end <= start) {
    return NextResponse.json(
      { error: "Provide url, start, and end (end after start)." },
      { status: 400 }
    );
  }
  if (!detectPlatform(url)) {
    return NextResponse.json(
      { error: "That doesn't look like a supported video URL." },
      { status: 422 }
    );
  }

  const dir = await mkdtemp(path.join(tmpdir(), "cwapa-clip-"));
  const cleanup = () => rm(dir, { recursive: true, force: true }).catch(() => {});
  try {
    const meta = await fetchMeta(url);
    const base =
      meta.title.replace(/[^\w\d -]+/g, "").trim().slice(0, 50) || "clip";
    const stamp = `${Math.floor(start)}-${Math.floor(end)}`;

    // --download-sections grabs only the requested range; force-keyframes
    // re-cuts at exact boundaries so the clip starts and ends where asked.
    const section = `*${start.toFixed(2)}-${end.toFixed(2)}`;
    await execYtDlp(
      url,
      [
        "--download-sections",
        section,
        "--force-keyframes-at-cuts",
        "-f",
        "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b",
        "--merge-output-format",
        "mp4",
        "-o",
        path.join(dir, "clip.%(ext)s"),
      ],
      { maxBuffer: 16 * 1024 * 1024, timeout: 600_000 }
    );

    const files = await readdir(dir);
    const raw = files.find((f) => f.startsWith("clip."));
    if (!raw) {
      await cleanup();
      return NextResponse.json({ error: "Clip extraction produced no file." }, { status: 502 });
    }
    const rawPath = path.join(dir, raw);
    // The raw clip segment came down through the proxy (clips aren't skipped).
    recordProxyBytes((await stat(rawPath)).size);

    let filePath = rawPath;
    let contentType = "video/mp4";
    let filename = `${base}_${stamp}.mp4`;

    if (format === "mp3") {
      filePath = path.join(dir, "clip.mp3");
      await execFileAsync(
        FFMPEG,
        ["-y", "-i", rawPath, "-vn", "-b:a", "192k", filePath],
        { maxBuffer: 16 * 1024 * 1024, timeout: 300_000 }
      );
      contentType = "audio/mpeg";
      filename = `${base}_${stamp}.mp3`;
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
    const explained = explainYtDlpFailure(String(err?.stderr || err?.message || ""));
    return NextResponse.json({ error: explained.message }, { status: explained.status });
  }
}

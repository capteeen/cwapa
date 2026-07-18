import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import { detectPlatform } from "@/lib/platform";
import {
  TranscribeError,
  YT_CLIENT_SETS,
  YT_DLP,
  commonArgs,
  fetchMeta,
  shouldRotateClient,
} from "@/lib/ytdlp";

export const runtime = "nodejs";
export const maxDuration = 300;

// Progressive mp4 keeps the output streamable to stdout (merging separate
// video+audio tracks can't stream); on YouTube this tops out around 720p.
const FORMAT = "best[ext=mp4]/best";

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

  try {
    const meta = await fetchMeta(url);
    const safeName =
      meta.title.replace(/[^\w\d -]+/g, "").trim().slice(0, 60) || "cwapa-video";

    // Rotate YouTube player clients when a failure is client-specific (DRM
    // poisoning, bot checks); wait for the first chunk on each attempt so a
    // failed download becomes a JSON error instead of an empty file.
    const attempts = platform === "youtube" ? YT_CLIENT_SETS.length : 1;
    let child: ReturnType<typeof spawn> | null = null;
    let firstChunk: Buffer | null = null;
    let stderrBuf = "";

    for (let i = 0; i < attempts; i++) {
      const c = spawn(YT_DLP, [...commonArgs(url, i), "-f", FORMAT, "-o", "-", url]);
      stderrBuf = "";
      c.stderr!.on("data", (d) => (stderrBuf += d));

      firstChunk = await new Promise<Buffer | null>((resolve, reject) => {
        c.stdout!.once("data", (d: Buffer) => {
          c.stdout!.pause();
          resolve(d);
        });
        c.once("exit", () => resolve(null));
        c.once("error", reject);
      });

      if (firstChunk) {
        child = c;
        break;
      }
      if (i + 1 < attempts && shouldRotateClient(stderrBuf)) continue;
      break;
    }

    if (!firstChunk || !child) {
      const line = stderrBuf.split("\n").find((l) => l.startsWith("ERROR:"));
      return NextResponse.json(
        { error: line ? line.replace(/^ERROR:\s*/, "") : "Download failed." },
        { status: 502 }
      );
    }
    const active = child;

    const chunk = firstChunk;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(chunk));
        active.stdout!.on("data", (d: Buffer) => controller.enqueue(new Uint8Array(d)));
        active.stdout!.on("end", () => controller.close());
        active.stdout!.on("error", (e) => controller.error(e));
        active.stdout!.resume();
      },
      cancel() {
        active.kill("SIGKILL");
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${safeName}.mp4"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof TranscribeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json(
        { error: "yt-dlp is not installed on the server." },
        { status: 500 }
      );
    }
    console.error("download failed:", err);
    return NextResponse.json({ error: "Download failed. Try again." }, { status: 500 });
  }
}

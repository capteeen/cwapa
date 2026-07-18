import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import { detectPlatform } from "@/lib/platform";
import { TranscribeError, YT_DLP, commonArgs, fetchMeta } from "@/lib/ytdlp";

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

    const child = spawn(YT_DLP, [...commonArgs(), "-f", FORMAT, "-o", "-", url]);
    let stderrBuf = "";
    child.stderr.on("data", (d) => (stderrBuf += d));

    // Wait for the first chunk so a failed download becomes a JSON error
    // instead of an empty file.
    const firstChunk = await new Promise<Buffer | null>((resolve, reject) => {
      child.stdout.once("data", (d: Buffer) => {
        child.stdout.pause();
        resolve(d);
      });
      child.once("exit", () => resolve(null));
      child.once("error", reject);
    });

    if (!firstChunk) {
      const line = stderrBuf.split("\n").find((l) => l.startsWith("ERROR:"));
      return NextResponse.json(
        { error: line ? line.replace(/^ERROR:\s*/, "") : "Download failed." },
        { status: 502 }
      );
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(firstChunk));
        child.stdout.on("data", (d: Buffer) => controller.enqueue(new Uint8Array(d)));
        child.stdout.on("end", () => controller.close());
        child.stdout.on("error", (e) => controller.error(e));
        child.stdout.resume();
      },
      cancel() {
        child.kill("SIGKILL");
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

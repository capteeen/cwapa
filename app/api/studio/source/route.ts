import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { detectPlatform } from "@/lib/platform";
import { guard } from "@/lib/ratelimit";
import { downloadStudioVideo } from "@/lib/video";
import { TranscribeError } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const limited = guard(req, { heavy: true });
  if (limited) return limited;
  const url = (req.nextUrl.searchParams.get("url") ?? "").trim();
  if (!detectPlatform(url)) {
    return NextResponse.json({ error: "Provide a supported video URL." }, { status: 422 });
  }

  const directory = await mkdtemp(path.join(tmpdir(), "cwapa-preview-"));
  const cleanup = () => rm(directory, { recursive: true, force: true }).catch(() => {});
  try {
    const filePath = await downloadStudioVideo(url, directory, 720);
    const size = (await stat(filePath)).size;
    const source = createReadStream(filePath);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        source.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
        source.on("end", () => {
          controller.close();
          void cleanup();
        });
        source.on("error", (error) => {
          controller.error(error);
          void cleanup();
        });
      },
      cancel() {
        source.destroy();
        void cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(size),
        "Content-Disposition": 'inline; filename="cwapa-preview.mp4"',
        "Cache-Control": "private, no-store",
        "Accept-Ranges": "none",
      },
    });
  } catch (error) {
    await cleanup();
    if (error instanceof TranscribeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("studio preview failed:", error);
    return NextResponse.json({ error: "Could not prepare the video preview." }, { status: 500 });
  }
}

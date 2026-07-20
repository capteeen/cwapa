import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { detectPlatform } from "@/lib/platform";
import { guard } from "@/lib/ratelimit";
import {
  DEFAULT_CAPTION_STYLE,
  type CaptionAspect,
  type CaptionPlacement,
  type CaptionStyle,
  toAss,
  validateSegments,
} from "@/lib/subtitles";
import { downloadStudioVideo } from "@/lib/video";
import { TranscribeError } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FONTS = new Set(["Helvetica", "Arial", "Georgia", "Courier New", "Impact"]);
const ASPECTS = new Set<CaptionAspect>(["9:16", "1:1", "16:9"]);
const PLACEMENTS = new Set<CaptionPlacement>(["top", "middle", "bottom"]);
const KARAOKE_MODES = new Set(["off", "fill", "pop", "word"]);

function hexOr(value: any, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function parseStyle(value: any): CaptionStyle {
  const d = DEFAULT_CAPTION_STYLE;
  // Legacy clients sent karaoke as a boolean.
  const karaoke = KARAOKE_MODES.has(value?.karaoke)
    ? value.karaoke
    : value?.karaoke === false
      ? "off"
      : value?.karaoke === true
        ? "fill"
        : d.karaoke;
  return {
    preset: typeof value?.preset === "string" ? value.preset.slice(0, 32) : d.preset,
    font: FONTS.has(value?.font) ? value.font : d.font,
    color: hexOr(value?.color, d.color),
    highlightColor: hexOr(value?.highlightColor, d.highlightColor),
    size: Math.min(120, Math.max(28, Number(value?.size) || d.size)),
    placement: PLACEMENTS.has(value?.placement) ? value.placement : d.placement,
    aspect: ASPECTS.has(value?.aspect) ? value.aspect : d.aspect,
    karaoke,
    uppercase: value?.uppercase === true,
    bold: value?.bold !== false,
    outline: Math.min(8, Math.max(0, Number(value?.outline) ?? d.outline)),
    outlineColor: hexOr(value?.outlineColor, d.outlineColor),
    shadow: Math.min(6, Math.max(0, Number(value?.shadow) ?? d.shadow)),
    box: value?.box === true,
    boxColor: hexOr(value?.boxColor, d.boxColor),
    glow: value?.glow === true,
  };
}

export async function POST(req: NextRequest) {
  const limited = guard(req, { heavy: true });
  if (limited) return limited;

  let url: string;
  let segments;
  let style: CaptionStyle;
  try {
    const body = await req.json();
    url = String(body?.url ?? "").trim();
    segments = validateSegments(body?.segments);
    style = parseStyle(body?.style);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid render request." },
      { status: 400 }
    );
  }
  if (!detectPlatform(url)) {
    return NextResponse.json({ error: "Provide a supported video URL." }, { status: 422 });
  }

  const dimensions: Record<CaptionAspect, [number, number]> = {
    "9:16": [1080, 1920],
    "1:1": [1080, 1080],
    "16:9": [1920, 1080],
  };
  const [width, height] = dimensions[style.aspect];
  const directory = await mkdtemp(path.join(tmpdir(), "cwapa-render-"));
  const cleanup = () => rm(directory, { recursive: true, force: true }).catch(() => {});

  try {
    const sourcePath = await downloadStudioVideo(url, directory);
    const subtitlePath = path.join(directory, "captions.ass");
    const outputPath = path.join(directory, "captioned.mp4");
    await writeFile(subtitlePath, toAss(segments, style), "utf8");

    const filter = [
      `scale=${width}:${height}:force_original_aspect_ratio=increase`,
      `crop=${width}:${height}`,
      `ass=${subtitlePath}`,
    ].join(",");

    try {
      await execFileAsync(
        FFMPEG,
        [
          "-y",
          "-i",
          sourcePath,
          "-vf",
          filter,
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-crf",
          "20",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-movflags",
          "+faststart",
          outputPath,
        ],
        { maxBuffer: 32 * 1024 * 1024, timeout: 900_000 }
      );
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        throw new TranscribeError("ffmpeg is not installed on the server.", 500);
      }
      console.error("caption render ffmpeg error:", String(error?.stderr ?? error));
      throw new TranscribeError("The captioned video could not be rendered.", 502);
    }

    const size = (await stat(outputPath)).size;
    const source = createReadStream(outputPath);
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
        "Content-Disposition": 'attachment; filename="cwapa-captioned.mp4"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    await cleanup();
    if (error instanceof TranscribeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("caption render failed:", error);
    return NextResponse.json({ error: "Caption rendering failed." }, { status: 500 });
  }
}

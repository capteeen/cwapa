import { execFile } from "node:child_process";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
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
import type { TranscriptSegment } from "@/lib/whisper";

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FONTS = new Set(["Helvetica", "Arial", "Georgia", "Courier New", "Impact"]);
const ASPECTS = new Set<CaptionAspect>(["9:16", "1:1", "16:9"]);
const PLACEMENTS = new Set<CaptionPlacement>(["top", "middle", "bottom"]);

export function parseCaptionStyle(value: any): CaptionStyle {
  const font = FONTS.has(value?.font) ? value.font : DEFAULT_CAPTION_STYLE.font;
  const color = /^#[0-9a-f]{6}$/i.test(value?.color) ? value.color : DEFAULT_CAPTION_STYLE.color;
  const size = Math.min(96, Math.max(28, Number(value?.size) || DEFAULT_CAPTION_STYLE.size));
  const placement = PLACEMENTS.has(value?.placement) ? value.placement : DEFAULT_CAPTION_STYLE.placement;
  const aspect = ASPECTS.has(value?.aspect) ? value.aspect : DEFAULT_CAPTION_STYLE.aspect;
  return { font, color, size, placement, aspect, karaoke: value?.karaoke !== false };
}

export interface RenderResult {
  directory: string;
  outputPath: string;
  size: number;
  cleanup: () => Promise<void>;
}

export async function renderCaptionedVideo(
  url: string,
  rawSegments: unknown,
  rawStyle: unknown,
  onProgress: (progress: number) => void | Promise<void> = () => {}
): Promise<RenderResult> {
  const segments = validateSegments(rawSegments as TranscriptSegment[]);
  const style = parseCaptionStyle(rawStyle);
  const dimensions: Record<CaptionAspect, [number, number]> = {
    "9:16": [1080, 1920], "1:1": [1080, 1080], "16:9": [1920, 1080],
  };
  const [width, height] = dimensions[style.aspect];
  const directory = await mkdtemp(path.join(tmpdir(), "cwapa-render-"));
  const cleanup = () => rm(directory, { recursive: true, force: true });

  try {
    await onProgress(12);
    const sourcePath = await downloadStudioVideo(url, directory);
    await onProgress(35);
    const subtitlePath = path.join(directory, "captions.ass");
    const outputPath = path.join(directory, "captioned.mp4");
    await writeFile(subtitlePath, toAss(segments, style), "utf8");
    const filter = [`scale=${width}:${height}:force_original_aspect_ratio=increase`, `crop=${width}:${height}`, `ass=${subtitlePath}`].join(",");
    try {
      await onProgress(45);
      await execFileAsync(FFMPEG, [
        "-y", "-i", sourcePath, "-vf", filter, "-c:v", "libx264", "-preset", "medium",
        "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outputPath,
      ], { maxBuffer: 32 * 1024 * 1024, timeout: 900_000 });
    } catch (error: any) {
      if (error?.code === "ENOENT") throw new TranscribeError("ffmpeg is not installed on the server.", 500);
      console.error("caption render ffmpeg error:", String(error?.stderr ?? error));
      throw new TranscribeError("The captioned video could not be rendered.", 502);
    }
    await onProgress(88);
    return { directory, outputPath, size: (await stat(outputPath)).size, cleanup };
  } catch (error) {
    await cleanup().catch(() => {});
    throw error;
  }
}

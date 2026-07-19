import type { TranscriptSegment } from "./whisper";

export type CaptionAspect = "9:16" | "1:1" | "16:9";
export type CaptionPlacement = "top" | "middle" | "bottom";

export interface CaptionStyle {
  font: "Helvetica" | "Arial" | "Georgia" | "Courier New" | "Impact";
  color: string;
  size: number;
  placement: CaptionPlacement;
  aspect: CaptionAspect;
  karaoke: boolean;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  font: "Helvetica",
  color: "#ffffff",
  size: 54,
  placement: "bottom",
  aspect: "9:16",
  karaoke: true,
};

function milliseconds(seconds: number): number {
  return Math.max(0, Math.round(seconds * 1000));
}

export function srtTimestamp(seconds: number): string {
  const ms = milliseconds(seconds);
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  const milli = String(ms % 1000).padStart(3, "0");
  return `${h}:${m}:${s},${milli}`;
}

export function vttTimestamp(seconds: number): string {
  return srtTimestamp(seconds).replace(",", ".");
}

export function toSrt(segments: TranscriptSegment[]): string {
  return segments
    .map(
      (segment, index) =>
        `${index + 1}\n${srtTimestamp(segment.start)} --> ${srtTimestamp(segment.end)}\n${segment.text.trim()}\n`
    )
    .join("\n");
}

export function toVtt(segments: TranscriptSegment[]): string {
  return `WEBVTT\n\n${segments
    .map(
      (segment) =>
        `${vttTimestamp(segment.start)} --> ${vttTimestamp(segment.end)}\n${segment.text.trim()}\n`
    )
    .join("\n")}`;
}

function assTimestamp(seconds: number): string {
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(centiseconds / 360_000);
  const m = String(Math.floor((centiseconds % 360_000) / 6_000)).padStart(2, "0");
  const s = String(Math.floor((centiseconds % 6_000) / 100)).padStart(2, "0");
  const cs = String(centiseconds % 100).padStart(2, "0");
  return `${h}:${m}:${s}.${cs}`;
}

function assColor(hex: string, alpha = "00"): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  const value = match?.[1] ?? "ffffff";
  const r = value.slice(0, 2);
  const g = value.slice(2, 4);
  const b = value.slice(4, 6);
  return `&H${alpha}${b}${g}${r}`.toUpperCase();
}

function escapeAss(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

function karaokeText(segment: TranscriptSegment): string {
  const words = segment.text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const duration = Math.max(1, Math.round((segment.end - segment.start) * 100));
  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let assigned = 0;

  return words
    .map((word, index) => {
      const remaining = duration - assigned;
      const wordDuration =
        index === words.length - 1
          ? remaining
          : Math.max(1, Math.round((duration * weights[index]) / weightTotal));
      assigned += wordDuration;
      return `{\\kf${wordDuration}}${escapeAss(word)}`;
    })
    .join(" ");
}

export function validateSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (!Array.isArray(segments) || segments.length === 0 || segments.length > 2_000) {
    throw new Error("Provide between 1 and 2,000 subtitle segments.");
  }
  return segments.map((segment) => {
    const start = Number(segment.start);
    const end = Number(segment.end);
    const text = String(segment.text ?? "").trim().slice(0, 1_000);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || !text) {
      throw new Error("Every subtitle needs valid text and an end time after its start time.");
    }
    return { start, end, text };
  });
}

export function toAss(segments: TranscriptSegment[], style: CaptionStyle): string {
  const dimensions: Record<CaptionAspect, [number, number]> = {
    "9:16": [1080, 1920],
    "1:1": [1080, 1080],
    "16:9": [1920, 1080],
  };
  const [width, height] = dimensions[style.aspect];
  const alignment = style.placement === "top" ? 8 : style.placement === "middle" ? 5 : 2;
  const margin = Math.round(height * 0.08);
  const primary = assColor(style.color);
  const secondary = assColor("#ffffff", "88");
  const fontSize = Math.min(96, Math.max(28, Math.round(style.size)));

  const events = validateSegments(segments)
    .map((segment) => {
      const text = style.karaoke ? karaokeText(segment) : escapeAss(segment.text);
      return `Dialogue: 0,${assTimestamp(segment.start)},${assTimestamp(segment.end)},Caption,,0,0,0,,${text}`;
    })
    .join("\n");

  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nScaledBorderAndShadow: yes\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,${style.font},${fontSize},${primary},${secondary},&HCC000000,&H66000000,-1,0,0,0,100,100,0,0,1,4,1,${alignment},70,70,${margin},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events}\n`;
}

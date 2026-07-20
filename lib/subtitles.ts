import type { TranscriptSegment } from "./whisper";

export type CaptionAspect = "9:16" | "1:1" | "16:9";
export type CaptionPlacement = "top" | "middle" | "bottom";
export type CaptionFont = "Helvetica" | "Arial" | "Georgia" | "Courier New" | "Impact";
/**
 * off   — static text
 * fill  — classic karaoke sweep across each word (\kf)
 * pop   — each word snaps to the highlight color as it is spoken (\k)
 * word  — one word on screen at a time (per-word events)
 */
export type KaraokeMode = "off" | "fill" | "pop" | "word";

export interface CaptionStyle {
  preset: string;
  font: CaptionFont;
  color: string;
  highlightColor: string;
  size: number;
  placement: CaptionPlacement;
  aspect: CaptionAspect;
  karaoke: KaraokeMode;
  uppercase: boolean;
  bold: boolean;
  outline: number;
  outlineColor: string;
  shadow: number;
  box: boolean;
  boxColor: string;
  glow: boolean;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  preset: "clean",
  font: "Helvetica",
  color: "#ffffff",
  highlightColor: "#5ac8fa",
  size: 54,
  placement: "bottom",
  aspect: "9:16",
  karaoke: "fill",
  uppercase: false,
  bold: true,
  outline: 3,
  outlineColor: "#000000",
  shadow: 1,
  box: false,
  boxColor: "#000000",
  glow: false,
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

/** Split a segment's duration across its words, weighted by word length. */
export function wordTimings(
  segment: TranscriptSegment
): { word: string; start: number; end: number }[] {
  const words = segment.text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const total = Math.max(0.01, segment.end - segment.start);
  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = segment.start;
  return words.map((word, index) => {
    const span =
      index === words.length - 1
        ? segment.end - cursor
        : (total * weights[index]) / weightTotal;
    const start = cursor;
    cursor += span;
    return { word, start, end: cursor };
  });
}

function karaokeText(segment: TranscriptSegment, tag: "kf" | "k", uppercase: boolean): string {
  const timings = wordTimings(segment);
  if (timings.length === 0) return "";
  return timings
    .map(({ word, start, end }) => {
      const centis = Math.max(1, Math.round((end - start) * 100));
      const text = uppercase ? word.toUpperCase() : word;
      return `{\\${tag}${centis}}${escapeAss(text)}`;
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

// The render container ships Liberation fonts; map the UI font names to
// metric-compatible faces so exports look like the preview.
const RENDER_FONTS: Record<CaptionFont, string> = {
  Helvetica: "Liberation Sans",
  Arial: "Liberation Sans",
  Georgia: "Liberation Serif",
  "Courier New": "Liberation Mono",
  Impact: "Liberation Sans Narrow",
};

export function toAss(segments: TranscriptSegment[], style: CaptionStyle): string {
  const dimensions: Record<CaptionAspect, [number, number]> = {
    "9:16": [1080, 1920],
    "1:1": [1080, 1080],
    "16:9": [1920, 1080],
  };
  const [width, height] = dimensions[style.aspect];
  const alignment = style.placement === "top" ? 8 : style.placement === "middle" ? 5 : 2;
  const margin = Math.round(height * 0.08);
  const fontSize = Math.min(120, Math.max(28, Math.round(style.size)));
  const fontName = RENDER_FONTS[style.font] ?? "Liberation Sans";

  // With \kf / \k, sung text uses PrimaryColour and unsung text uses
  // SecondaryColour — so karaoke modes put the highlight in Primary.
  const karaokeOn = style.karaoke === "fill" || style.karaoke === "pop";
  const primary = assColor(karaokeOn ? style.highlightColor : style.color);
  const secondary = assColor(style.color, karaokeOn ? "20" : "00");
  const outlineColor = assColor(style.glow ? style.highlightColor : style.outlineColor);
  const borderStyle = style.box ? 3 : 1;
  const back = style.box ? assColor(style.boxColor, "1A") : "&H66000000";
  const outline = Math.min(8, Math.max(0, Math.round(style.outline)));
  const shadow = Math.min(6, Math.max(0, Math.round(style.shadow)));
  const bold = style.bold ? -1 : 0;
  const prefix = style.glow ? "{\\blur6}" : "";

  const valid = validateSegments(segments);
  const events: string[] = [];

  if (style.karaoke === "word") {
    for (const segment of valid) {
      for (const { word, start, end } of wordTimings(segment)) {
        const text = escapeAss(style.uppercase ? word.toUpperCase() : word);
        events.push(
          `Dialogue: 0,${assTimestamp(start)},${assTimestamp(end)},Caption,,0,0,0,,${prefix}${text}`
        );
      }
    }
  } else {
    for (const segment of valid) {
      const text =
        style.karaoke === "off"
          ? escapeAss(style.uppercase ? segment.text.toUpperCase() : segment.text)
          : karaokeText(segment, style.karaoke === "fill" ? "kf" : "k", style.uppercase);
      events.push(
        `Dialogue: 0,${assTimestamp(segment.start)},${assTimestamp(segment.end)},Caption,,0,0,0,,${prefix}${text}`
      );
    }
  }

  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nScaledBorderAndShadow: yes\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,${fontName},${fontSize},${primary},${secondary},${outlineColor},${back},${bold},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignment},70,70,${margin},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events.join("\n")}\n`;
}

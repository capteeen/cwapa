import type { CaptionStyle } from "./subtitles";

/**
 * Trending caption looks. A preset sets everything except canvas aspect and
 * placement, which stay whatever the user chose.
 */
export interface CaptionPreset {
  id: string;
  name: string;
  tag: string;
  style: Omit<CaptionStyle, "preset" | "aspect" | "placement">;
}

export const CAPTION_PRESETS: CaptionPreset[] = [
  {
    id: "clean",
    name: "Clean",
    tag: "Timeless",
    style: {
      font: "Helvetica",
      color: "#ffffff",
      highlightColor: "#5ac8fa",
      size: 54,
      karaoke: "fill",
      uppercase: false,
      bold: true,
      outline: 3,
      outlineColor: "#000000",
      shadow: 1,
      box: false,
      boxColor: "#000000",
      glow: false,
    },
  },
  {
    id: "beast",
    name: "Beast",
    tag: "MrBeast style",
    style: {
      font: "Impact",
      color: "#ffffff",
      highlightColor: "#ffd400",
      size: 74,
      karaoke: "pop",
      uppercase: true,
      bold: true,
      outline: 6,
      outlineColor: "#000000",
      shadow: 2,
      box: false,
      boxColor: "#000000",
      glow: false,
    },
  },
  {
    id: "hormozi",
    name: "Hormozi",
    tag: "Podcast clips",
    style: {
      font: "Arial",
      color: "#ffffff",
      highlightColor: "#3bff6f",
      size: 64,
      karaoke: "pop",
      uppercase: true,
      bold: true,
      outline: 5,
      outlineColor: "#000000",
      shadow: 2,
      box: false,
      boxColor: "#000000",
      glow: false,
    },
  },
  {
    id: "wordpop",
    name: "Word Pop",
    tag: "One word at a time",
    style: {
      font: "Impact",
      color: "#ffffff",
      highlightColor: "#ffffff",
      size: 88,
      karaoke: "word",
      uppercase: true,
      bold: true,
      outline: 6,
      outlineColor: "#000000",
      shadow: 2,
      box: false,
      boxColor: "#000000",
      glow: false,
    },
  },
  {
    id: "karaoke",
    name: "Karaoke",
    tag: "Sweep fill",
    style: {
      font: "Helvetica",
      color: "#9aa0a6",
      highlightColor: "#ffffff",
      size: 56,
      karaoke: "fill",
      uppercase: false,
      bold: true,
      outline: 3,
      outlineColor: "#000000",
      shadow: 1,
      box: false,
      boxColor: "#000000",
      glow: false,
    },
  },
  {
    id: "bubble",
    name: "Bubble",
    tag: "Reels favorite",
    style: {
      font: "Arial",
      color: "#111111",
      highlightColor: "#111111",
      size: 52,
      karaoke: "off",
      uppercase: false,
      bold: true,
      outline: 4,
      outlineColor: "#ffffff",
      shadow: 0,
      box: true,
      boxColor: "#ffffff",
      glow: false,
    },
  },
  {
    id: "neon",
    name: "Neon",
    tag: "Glow",
    style: {
      font: "Helvetica",
      color: "#ffffff",
      highlightColor: "#ff2d95",
      size: 58,
      karaoke: "pop",
      uppercase: true,
      bold: true,
      outline: 2,
      outlineColor: "#ff2d95",
      shadow: 0,
      box: false,
      boxColor: "#000000",
      glow: true,
    },
  },
];

export function applyPreset(current: CaptionStyle, preset: CaptionPreset): CaptionStyle {
  return {
    ...current,
    ...preset.style,
    preset: preset.id,
    aspect: current.aspect,
    placement: current.placement,
  };
}

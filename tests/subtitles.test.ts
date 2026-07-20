import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CAPTION_STYLE,
  srtTimestamp,
  toAss,
  toSrt,
  toVtt,
  validateSegments,
} from "../lib/subtitles.ts";

const segments = [
  { start: 0.04, end: 1.52, text: "Hello world" },
  { start: 1.52, end: 3.005, text: "Frame accurate captions" },
];

test("SRT preserves millisecond timing", () => {
  assert.equal(srtTimestamp(3.005), "00:00:03,005");
  assert.match(toSrt(segments), /00:00:00,040 --> 00:00:01,520/);
});

test("VTT uses the standard header and decimal separator", () => {
  const vtt = toVtt(segments);
  assert.ok(vtt.startsWith("WEBVTT\n\n"));
  assert.match(vtt, /00:00:01\.520 --> 00:00:03\.005/);
});

test("ASS output includes exact events and karaoke timing", () => {
  const ass = toAss(segments, DEFAULT_CAPTION_STYLE);
  assert.match(ass, /Dialogue: 0,0:00:00\.04,0:00:01\.52/);
  assert.match(ass, /\{\\kf\d+\}Hello \{\\kf\d+\}world/);
  assert.match(ass, /PlayResX: 1080\nPlayResY: 1920/);
});

test("invalid or inverted subtitle ranges are rejected", () => {
  assert.throws(
    () => validateSegments([{ start: 2, end: 1, text: "bad" }]),
    /end time after its start time/
  );
});

test("pop mode uses \\k and uppercase transforms text", () => {
  const ass = toAss(segments, {
    ...DEFAULT_CAPTION_STYLE,
    karaoke: "pop",
    uppercase: true,
  });
  assert.match(ass, /\{\\k\d+\}HELLO \{\\k\d+\}WORLD/);
});

test("word mode emits one event per word", () => {
  const ass = toAss([{ start: 0, end: 2, text: "one two three" }], {
    ...DEFAULT_CAPTION_STYLE,
    karaoke: "word",
  });
  const events = ass.split("\n").filter((line) => line.startsWith("Dialogue:"));
  assert.equal(events.length, 3);
  assert.match(events[0], /,one$/);
  assert.match(events[2], /,three$/);
});

test("box style switches to BorderStyle 3", () => {
  const ass = toAss(segments, { ...DEFAULT_CAPTION_STYLE, box: true, karaoke: "off" });
  assert.match(ass, /,100,100,0,0,3,\d+,\d+,/);
});

test("Impact exports use the condensed font installed in the render image", () => {
  const ass = toAss(segments, { ...DEFAULT_CAPTION_STYLE, font: "Impact" });
  assert.match(ass, /Style: Caption,Nimbus Sans Narrow,/);
});

test("modern caption fonts keep their family names in exported ASS", () => {
  for (const font of ["Inter", "Roboto", "Open Sans", "Lato", "Comic Neue"] as const) {
    const ass = toAss(segments, { ...DEFAULT_CAPTION_STYLE, font });
    assert.match(ass, new RegExp(`Style: Caption,${font},`));
  }
});

test("presets apply while preserving canvas and placement", async () => {
  const { CAPTION_PRESETS, applyPreset } = await import("../lib/captionPresets.ts");
  const beast = CAPTION_PRESETS.find((preset) => preset.id === "beast")!;
  const styled = applyPreset(
    { ...DEFAULT_CAPTION_STYLE, aspect: "16:9", placement: "top" },
    beast
  );
  assert.equal(styled.preset, "beast");
  assert.equal(styled.uppercase, true);
  assert.equal(styled.aspect, "16:9");
  assert.equal(styled.placement, "top");
});

test("trend presets use unique ids and include readable short-form categories", async () => {
  const { CAPTION_PRESETS } = await import("../lib/captionPresets.ts");
  assert.equal(new Set(CAPTION_PRESETS.map((preset) => preset.id)).size, CAPTION_PRESETS.length);
  assert.ok(CAPTION_PRESETS.length >= 12);
  for (const id of ["shorts", "podcast", "explainer", "breaking", "playful"]) {
    assert.ok(CAPTION_PRESETS.some((preset) => preset.id === id));
  }
});

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

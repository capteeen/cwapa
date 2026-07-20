import test from "node:test";
import assert from "node:assert/strict";
import { getYouTubeVideoId } from "../lib/platform.ts";

test("extracts IDs from supported YouTube URL formats", () => {
  assert.equal(
    getYouTubeVideoId("https://www.youtube.com/watch?v=p7l0bmg5Bks&t=10"),
    "p7l0bmg5Bks"
  );
  assert.equal(getYouTubeVideoId("https://youtu.be/p7l0bmg5Bks"), "p7l0bmg5Bks");
  assert.equal(
    getYouTubeVideoId("https://www.youtube.com/shorts/p7l0bmg5Bks"),
    "p7l0bmg5Bks"
  );
});

test("rejects non-YouTube and malformed URLs", () => {
  assert.equal(getYouTubeVideoId("https://example.com/watch?v=p7l0bmg5Bks"), null);
  assert.equal(getYouTubeVideoId("not a url"), null);
});

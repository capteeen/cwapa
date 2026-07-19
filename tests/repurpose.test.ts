import test from "node:test";
import assert from "node:assert/strict";
import { parseRepurposeResponse } from "../lib/repurpose.ts";

test("parses a structured repurposing response", () => {
  const result = parseRepurposeResponse(JSON.stringify({ tiktok: "Caption #video", x: ["Hook", "Point"], linkedin: "A post", hooks: ["Wait for it"], titles: ["The lesson"] }));
  assert.equal(result.tiktok, "Caption #video"); assert.deepEqual(result.x, ["Hook", "Point"]); assert.equal(result.titles[0], "The lesson");
});
test("accepts JSON fenced by a model", () => { assert.equal(parseRepurposeResponse('```json\n{"tiktok":"Hi","x":[],"linkedin":"","hooks":[],"titles":[]}\n```').tiktok, "Hi"); });
test("rejects empty model output", () => { assert.throws(() => parseRepurposeResponse('{"tiktok":"","x":[]}'), /empty response/); });

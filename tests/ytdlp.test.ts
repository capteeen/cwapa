import assert from "node:assert/strict";
import test from "node:test";
import {
  isTransientYtDlpFailure,
  tiktokAttemptCount,
} from "../lib/ytdlp-retry.ts";

test("TikTok TLS EOF failures are retried as transient network errors", () => {
  const stderr = "Unable to download webpage: TLS/SSL connection has been closed (EOF) (caused by SSLError)";
  assert.equal(isTransientYtDlpFailure(stderr), true);
  assert.equal(tiktokAttemptCount(undefined), 3);
  assert.equal(tiktokAttemptCount("10"), 5);
  assert.equal(tiktokAttemptCount("invalid"), 3);
});

test("permanent extractor failures are not classified as transient", () => {
  assert.equal(isTransientYtDlpFailure("ERROR: Unsupported URL"), false);
  assert.equal(isTransientYtDlpFailure("ERROR: This video is private"), false);
});

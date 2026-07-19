let lastAlert = 0;
const THROTTLE_MS = Number(process.env.ALERT_THROTTLE_MS || 60 * 60 * 1000); // 1h

/**
 * Fire-and-forget alert to a Discord/Slack-compatible incoming webhook when
 * YouTube blocks a download (usually meaning the cookies need refreshing).
 * No-op unless ALERT_WEBHOOK_URL is set; throttled so we don't spam.
 */
export function notifyCookieIssue(detail: string): void {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  const now = Date.now();
  if (now - lastAlert < THROTTLE_MS) return;
  lastAlert = now;

  const message = `⚠️ cwapa: YouTube blocked a download — your cookies likely need refreshing. Update them at /admin/cookies. (${detail})`;
  // Discord expects { content }, Slack expects { text }; send both.
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message, text: message }),
  }).catch(() => {
    /* alerting is best-effort */
  });
}

/** Network failures that are safe to retry as a completely fresh request. */
export function isTransientYtDlpFailure(stderr: string): boolean {
  const s = stderr.toLowerCase();
  return (
    s.includes("tls/ssl connection has been closed") ||
    s.includes("sslerror") ||
    s.includes("unexpected eof") ||
    s.includes("eof occurred in violation of protocol") ||
    s.includes("connection reset") ||
    s.includes("remote end closed connection") ||
    s.includes("read operation timed out") ||
    s.includes("the read operation timed out") ||
    s.includes("temporary failure in name resolution")
  );
}

export function tiktokAttemptCount(value: string | undefined): number {
  const parsed = Number(value || 3);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(5, Math.max(1, Math.round(parsed)));
}

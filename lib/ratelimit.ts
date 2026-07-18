import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight in-memory sliding-window rate limiter keyed by client IP.
 * Good enough for a single Railway instance; swap for Redis/Upstash if the
 * app is ever scaled to multiple replicas (each replica keeps its own counts).
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000); // 1h
const MAX_HITS = Number(process.env.RATE_LIMIT_MAX || 20);
// Heavy endpoints (download, transcription) can carry a stricter budget.
const HEAVY_MAX = Number(process.env.RATE_LIMIT_HEAVY_MAX || 12);

// Occasionally evict stale buckets so the map doesn't grow unbounded.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  { heavy = false }: { heavy?: boolean } = {}
): RateResult {
  if (process.env.RATE_LIMIT_DISABLED === "1") {
    return { ok: true, remaining: Infinity, retryAfterSeconds: 0 };
  }
  const now = Date.now();
  sweep(now);
  const limit = heavy ? HEAVY_MAX : MAX_HITS;

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/** Human-friendly "try again in ~X" phrasing. */
export function retryPhrase(seconds: number): string {
  if (seconds < 90) return "in about a minute";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `in about ${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.round(mins / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * Guard a route: returns a ready-to-send 429 NextResponse when the caller is
 * over budget, or null when the request may proceed.
 */
export function guard(
  req: NextRequest,
  opts: { heavy?: boolean } = {}
): NextResponse | null {
  const result = rateLimit(clientIp(req), opts);
  if (result.ok) return null;
  return NextResponse.json(
    {
      error: `You've hit the usage limit for now — try again ${retryPhrase(
        result.retryAfterSeconds
      )}. Higher limits are coming with accounts.`,
    },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
  );
}

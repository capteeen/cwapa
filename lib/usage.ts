import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { notifyUsage } from "./alert";

/**
 * Approximate tracker for bytes pulled through the (metered) residential
 * proxy, so you can see usage at a glance and get an early-warning ping
 * before you blow through your GB budget. IPRoyal's own dashboard is the
 * source of truth; this is a convenience meter.
 *
 * Persisted next to the cookie store (set COOKIES_STORE_PATH to a volume so
 * it survives restarts); otherwise it lives in /tmp and resets on redeploy.
 */

interface Usage {
  month: string;
  bytes: number;
  alerted: number[];
}

let cache: Usage | null = null;

function file(): string {
  const base = process.env.COOKIES_STORE_PATH
    ? path.dirname(process.env.COOKIES_STORE_PATH)
    : tmpdir();
  return path.join(base, "cwapa-usage.json");
}

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function load(): Usage {
  if (!cache) {
    try {
      cache = JSON.parse(readFileSync(file(), "utf8")) as Usage;
    } catch {
      cache = { month: monthKey(), bytes: 0, alerted: [] };
    }
  }
  if (cache!.month !== monthKey()) {
    cache = { month: monthKey(), bytes: 0, alerted: [] }; // new month resets
  }
  return cache!;
}

function save(u: Usage) {
  cache = u;
  try {
    mkdirSync(path.dirname(file()), { recursive: true });
    writeFileSync(file(), JSON.stringify(u));
  } catch {
    /* best-effort */
  }
}

/** Record bytes that went through the proxy (no-op if proxy off or skipped). */
export function recordProxyBytes(bytes: number, opts: { skipped?: boolean } = {}): void {
  if (!process.env.YT_DLP_PROXY || opts.skipped || !(bytes > 0)) return;
  const u = load();
  u.bytes += bytes;

  const capGB = Number(process.env.PROXY_MONTHLY_GB || 0);
  if (capGB > 0) {
    const pct = (u.bytes / (capGB * 1e9)) * 100;
    for (const threshold of [80, 100]) {
      if (pct >= threshold && !u.alerted.includes(threshold)) {
        u.alerted.push(threshold);
        notifyUsage(
          `Proxy usage at ${Math.round(pct)}% of your ${capGB} GB monthly budget (${(
            u.bytes / 1e9
          ).toFixed(2)} GB used).`
        );
      }
    }
  }
  save(u);
}

export function usageStatus(): {
  month: string;
  gb: number;
  capGB: number | null;
  pct: number | null;
} {
  const u = load();
  const capGB = Number(process.env.PROXY_MONTHLY_GB || 0) || null;
  return {
    month: u.month,
    gb: Number((u.bytes / 1e9).toFixed(3)),
    capGB,
    pct: capGB ? Math.round((u.bytes / (capGB * 1e9)) * 100) : null,
  };
}

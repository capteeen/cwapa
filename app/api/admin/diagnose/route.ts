import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookiesStatus, fetchMeta } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const maxDuration = 120;
// Read env and run the live test on every request, never prerender/cache.
export const dynamic = "force-dynamic";

// "Me at the zoo" — the first YouTube video, stable and always public.
const TEST_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

function authorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const provided = req.headers.get("x-admin-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function proxyStatus(): { configured: boolean; endpoint: string | null } {
  const p = process.env.YT_DLP_PROXY;
  if (!p) return { configured: false, endpoint: null };
  try {
    const u = new URL(p);
    return {
      configured: true,
      endpoint: `${u.protocol}//${u.hostname}:${u.port || "(default)"} · auth: ${u.username ? "yes" : "no"}`,
    };
  } catch {
    return { configured: true, endpoint: "set (could not parse)" };
  }
}

export async function GET(req: NextRequest) {
  if (!process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Admin is disabled (set ADMIN_TOKEN)." }, { status: 404 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const config = {
    proxy: proxyStatus(),
    skipProxyOnDownloads: process.env.YT_DLP_PROXY_SKIP_DOWNLOADS === "1",
    cookies: cookiesStatus(),
  };

  // Real end-to-end test through the live config (metadata only — tiny).
  let test: { ok: boolean; title?: string; error?: string };
  const started = Date.now();
  try {
    const meta = await fetchMeta(TEST_URL);
    test = { ok: true, title: meta.title };
  } catch (err: any) {
    test = { ok: false, error: err?.message ?? String(err) };
  }
  const tookMs = Date.now() - started;

  return NextResponse.json({ config, test, tookMs });
}

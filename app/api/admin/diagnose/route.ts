import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ProxyAgent, request } from "undici";
import { cookiesStatus, fetchMeta } from "@/lib/ytdlp";
import { usageStatus } from "@/lib/usage";

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

// Ask an echo service what IP it sees us from — directly and via the proxy.
// This distinguishes "proxy isn't routing" from "proxy IP is flagged".
async function egressIps(): Promise<{
  direct: string | null;
  throughProxy: string | null;
  proxyError: string | null;
}> {
  const ipUrl = "https://api.ipify.org?format=json";
  let direct: string | null = null;
  let throughProxy: string | null = null;
  let proxyError: string | null = null;

  try {
    const r = await request(ipUrl, { headersTimeout: 15_000, bodyTimeout: 15_000 });
    direct = ((await r.body.json()) as { ip?: string }).ip ?? null;
  } catch {
    /* ignore */
  }

  const proxy = process.env.YT_DLP_PROXY;
  if (proxy) {
    try {
      const dispatcher = new ProxyAgent(proxy);
      const r = await request(ipUrl, {
        dispatcher,
        headersTimeout: 15_000,
        bodyTimeout: 15_000,
      });
      throughProxy = ((await r.body.json()) as { ip?: string }).ip ?? null;
    } catch (e: any) {
      proxyError = String(e?.message ?? e).slice(0, 200);
    }
  }
  return { direct, throughProxy, proxyError };
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
    usage: usageStatus(),
  };

  const egress = await egressIps();

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

  return NextResponse.json({ config, egress, test, tookMs });
}

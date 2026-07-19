import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookiesStatus, saveCookies } from "@/lib/ytdlp";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false; // feature disabled until a token is set
  const provided = req.headers.get("x-admin-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Admin is disabled (set ADMIN_TOKEN)." }, { status: 404 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json(cookiesStatus());
}

export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Admin is disabled (set ADMIN_TOKEN)." }, { status: 404 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const content = (await req.text()).trim();
  if (!content) {
    return NextResponse.json({ error: "Empty cookies content." }, { status: 400 });
  }
  // A Netscape cookies.txt has this header or at least tab-separated domain lines.
  const looksValid =
    content.includes("# Netscape HTTP Cookie File") ||
    /\t(TRUE|FALSE)\t/.test(content) ||
    content.includes(".youtube.com");
  if (!looksValid) {
    return NextResponse.json(
      { error: "That doesn't look like a cookies.txt export." },
      { status: 422 }
    );
  }

  saveCookies(content);
  return NextResponse.json({ ok: true, ...cookiesStatus() });
}

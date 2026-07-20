import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { detectPlatform } from "@/lib/platform";
import { parseCaptionStyle } from "@/lib/rendering";
import { getInsForgeServerClient } from "@/lib/insforge-server";
import { validateSegments } from "@/lib/subtitles";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const client = await getInsForgeServerClient();
    const user = await client.auth.getCurrentUser();
    if (user.error || !user.data?.user) return NextResponse.json({ error: "Sign in to render videos." }, { status: 401 });
    const body = await request.json();
    const url = String(body?.url || "").trim();
    if (!detectPlatform(url)) return NextResponse.json({ error: "Provide a supported video URL." }, { status: 422 });
    const segments = validateSegments(body?.segments);
    const style = parseCaptionStyle(body?.style);
    const idempotencyKey = String(body?.idempotencyKey || randomUUID()).slice(0, 160);
    const result = await client.database.rpc("enqueue_render_job", {
      p_source_url: url,
      p_project_id: body?.projectId || null,
      p_title: String(body?.title || "Caption render").slice(0, 180),
      p_style: style,
      p_segments: segments,
      p_idempotency_key: idempotencyKey,
    });
    if (result.error) throw result.error;
    return NextResponse.json({ jobId: String(result.data), status: "queued" }, { status: 202 });
  } catch (reason: any) {
    const message = String(reason?.message || "Could not queue the render.");
    return NextResponse.json({ error: message }, { status: /credit/i.test(message) ? 402 : 400 });
  }
}

export async function GET() {
  try {
    const client = await getInsForgeServerClient();
    const user = await client.auth.getCurrentUser();
    if (user.error || !user.data?.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const [jobs, account, ledger] = await Promise.all([
      client.database.from("render_jobs").select("id,project_id,title,status,progress,attempt_count,max_attempts,output_url,output_bytes,error_message,credit_refunded,created_at,started_at,completed_at").order("created_at", { ascending: false }).limit(50),
      client.database.from("usage_accounts").select("credits_available,lifetime_credits_used,lifetime_credits_refunded,updated_at").maybeSingle(),
      client.database.from("usage_ledger").select("id,job_id,kind,credit_delta,description,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    if (jobs.error) throw jobs.error;
    if (account.error) throw account.error;
    if (ledger.error) throw ledger.error;
    return NextResponse.json({ jobs: jobs.data || [], account: account.data || null, ledger: ledger.data || [] });
  } catch (reason: any) {
    return NextResponse.json({ error: reason?.message || "Could not load render history." }, { status: 500 });
  }
}

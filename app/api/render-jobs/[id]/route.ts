import { NextRequest, NextResponse } from "next/server";
import { getInsForgeServerClient } from "@/lib/insforge-server";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const client = await getInsForgeServerClient();
    const result = await client.database.from("render_jobs")
      .select("id,title,status,progress,attempt_count,max_attempts,output_url,output_bytes,error_message,credit_refunded,created_at,started_at,completed_at")
      .eq("id", id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return NextResponse.json({ error: "Render not found." }, { status: 404 });
    return NextResponse.json({ job: result.data });
  } catch (reason: any) {
    return NextResponse.json({ error: reason?.message || "Could not load the render." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const client = await getInsForgeServerClient();
    const result = await client.database.rpc("cancel_render_job", { p_job_id: id });
    if (result.error) throw result.error;
    return NextResponse.json({ cancelled: Boolean(result.data) });
  } catch (reason: any) {
    return NextResponse.json({ error: reason?.message || "Could not cancel the render." }, { status: 400 });
  }
}

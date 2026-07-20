import { NextRequest, NextResponse } from "next/server";
import { getInsForgeServerClient } from "@/lib/insforge-server";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const client = await getInsForgeServerClient();
    const job = await client.database.from("render_jobs").select("title,status,output_key").eq("id", id).maybeSingle();
    if (job.error) throw job.error;
    if (!job.data || job.data.status !== "succeeded" || !job.data.output_key) {
      return NextResponse.json({ error: "This render is not ready yet." }, { status: 409 });
    }
    const downloaded = await client.storage.from("renders").download(job.data.output_key);
    if (downloaded.error || !downloaded.data) throw downloaded.error || new Error("Render download failed.");
    const title = String(job.data.title || "cwapa-captioned").replace(/[^a-z0-9 -]+/gi, "").slice(0, 60);
    return new Response(downloaded.data, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${title || "cwapa-captioned"}.mp4"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (reason: any) {
    return NextResponse.json({ error: reason?.message || "Could not download the render." }, { status: 500 });
  }
}

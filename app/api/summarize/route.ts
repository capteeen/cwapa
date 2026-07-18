import { NextRequest, NextResponse } from "next/server";
import { summarizeTranscript } from "@/lib/summarize";
import { TranscribeError } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let text: string;
  try {
    const body = await req.json();
    text = String(body?.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Nothing to summarize." }, { status: 400 });
  }

  try {
    const summary = await summarizeTranscript(text);
    return NextResponse.json({ summary });
  } catch (err) {
    if (err instanceof TranscribeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("summarize failed:", err);
    return NextResponse.json({ error: "Summarizing failed. Try again." }, { status: 500 });
  }
}

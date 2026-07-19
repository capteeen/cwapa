import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/ratelimit";
import { translateTranscript } from "@/lib/translate";
import { TranscribeError } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = guard(req);
  if (limited) return limited;

  let text: string;
  let targetLanguage: string;
  try {
    const body = await req.json();
    text = String(body?.text ?? "").trim();
    targetLanguage = String(body?.targetLanguage ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "Nothing to translate." }, { status: 400 });
  }
  if (text.length > 32_000) {
    return NextResponse.json(
      { error: "This transcript is too long to translate in one request." },
      { status: 413 }
    );
  }

  try {
    const translation = await translateTranscript(text, targetLanguage);
    return NextResponse.json({ translation, targetLanguage });
  } catch (err) {
    if (err instanceof TranscribeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("translate failed:", err);
    return NextResponse.json({ error: "Translation failed. Try again." }, { status: 500 });
  }
}

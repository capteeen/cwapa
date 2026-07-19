import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/ratelimit";
import { REPURPOSE_FORMATS, RepurposeError, repurposeTranscript, type RepurposeFormat } from "@/lib/repurpose";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const limited = guard(request); if (limited) return limited;
  let transcript = ""; let formats: RepurposeFormat[] = [...REPURPOSE_FORMATS];
  try { const body = await request.json(); transcript = String(body?.transcript ?? "").trim(); if (Array.isArray(body?.formats)) formats = REPURPOSE_FORMATS.filter((format) => body.formats.includes(format)); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (transcript.length < 40) return NextResponse.json({ error: "Add a little more transcript so the content stays accurate." }, { status: 400 });
  if (transcript.length > 32_000) return NextResponse.json({ error: "This transcript is too long for one generation." }, { status: 413 });
  if (!formats.length) return NextResponse.json({ error: "Choose at least one content format." }, { status: 400 });
  try { return NextResponse.json({ content: await repurposeTranscript(transcript, formats) }); }
  catch (error) { if (error instanceof RepurposeError) return NextResponse.json({ error: error.message }, { status: error.status }); console.error("repurpose failed:", error); return NextResponse.json({ error: "Content generation failed. Try again." }, { status: 500 }); }
}

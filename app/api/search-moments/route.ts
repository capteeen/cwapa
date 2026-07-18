import { NextRequest, NextResponse } from "next/server";
import { TranscribeError } from "@/lib/ytdlp";
import { guard } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Segment {
  start: number;
  end: number;
  text: string;
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const limited = guard(req);
  if (limited) return limited;

  let query: string;
  let segments: Segment[];
  try {
    const body = await req.json();
    query = String(body?.query ?? "").trim();
    segments = Array.isArray(body?.segments) ? body.segments.slice(0, 1000) : [];
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!query || segments.length === 0) {
    return NextResponse.json({ error: "Missing query or transcript." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }
  const isGroq = (process.env.WHISPER_API_URL ?? "").includes("groq.com");
  const url =
    process.env.LLM_API_URL ||
    (isGroq
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions");
  const model =
    process.env.LLM_MODEL || (isGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini");

  const numbered = segments
    .map((s, i) => `${i} | ${clock(s.start)} | ${s.text}`)
    .join("\n")
    .slice(0, 28_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              'You find moments in video transcripts. Given numbered transcript segments and a search query, return the segments that semantically match the query — talking about the topic counts, exact words are not required. Reply with ONLY JSON: {"matches":[{"i":<segment number>,"reason":"<short why, max 10 words>"}]} with at most 8 matches, best first. No other text.',
          },
          { role: "user", content: `Query: ${query}\n\nSegments:\n${numbered}` },
        ],
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new TranscribeError(
        `Search service error (${res.status}): ${body.slice(0, 200)}`,
        502
      );
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const jsonText = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonText);
    const matches = (Array.isArray(parsed.matches) ? parsed.matches : [])
      .filter(
        (m: any) =>
          Number.isInteger(m?.i) && m.i >= 0 && m.i < segments.length
      )
      .slice(0, 8)
      .map((m: any) => ({
        index: m.i,
        reason: typeof m.reason === "string" ? m.reason : "",
        segment: segments[m.i],
      }));

    return NextResponse.json({ matches });
  } catch (err) {
    if (err instanceof TranscribeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("search-moments failed:", err);
    return NextResponse.json(
      { error: "Moment search failed. Try again." },
      { status: 500 }
    );
  }
}

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
    segments = Array.isArray(body?.segments) ? body.segments.slice(0, 1200) : [];
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

  const videoEnd = segments[segments.length - 1]?.end ?? 0;
  const numbered = segments
    .map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`)
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
              'You are a video editor finding clip-worthy moments. Given transcript segments with [start-end] times in seconds and a description of the clip the user wants, return self-contained clips that match — semantically, not just by keyword. Each clip should be a coherent, shareable moment: extend a little before and after so it does not start or end mid-sentence, typically 8-60 seconds. Return ONLY JSON: {"clips":[{"start":<sec>,"end":<sec>,"title":"<3-6 word title>","reason":"<why it fits, max 12 words>"}]} with at most 6 clips, best first, ordered by time. No other text.',
          },
          {
            role: "user",
            content: `Wanted clip: ${query}\n\nVideo length: ${videoEnd.toFixed(0)}s\n\nTranscript:\n${numbered}`,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new TranscribeError(
        `Clip search error (${res.status}): ${body.slice(0, 200)}`,
        502
      );
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const jsonText = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonText);

    const clips = (Array.isArray(parsed.clips) ? parsed.clips : [])
      .map((c: any) => {
        let start = Number(c?.start);
        let end = Number(c?.end);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
        start = Math.max(0, start);
        end = Math.min(videoEnd || end, end);
        if (end - start < 2) end = start + 2;
        return {
          start,
          end,
          title: typeof c?.title === "string" ? c.title : "Clip",
          reason: typeof c?.reason === "string" ? c.reason : "",
          label: `${clock(start)} – ${clock(end)}`,
        };
      })
      .filter(Boolean)
      .slice(0, 6);

    return NextResponse.json({ clips });
  } catch (err) {
    if (err instanceof TranscribeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("find-clips failed:", err);
    return NextResponse.json({ error: "Clip search failed. Try again." }, { status: 500 });
  }
}

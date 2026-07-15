import { NextRequest, NextResponse } from "next/server";
import { detectPlatform } from "@/lib/platform";
import {
  TranscribeError,
  downloadAudio,
  fetchMeta,
  fetchYoutubeCaptions,
} from "@/lib/ytdlp";
import { transcribeWithWhisper, type TranscriptResult } from "@/lib/whisper";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let url: string;
  try {
    const body = await req.json();
    url = String(body?.url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!url) {
    return NextResponse.json({ error: "Paste a video URL first." }, { status: 400 });
  }

  const platform = detectPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: "That doesn't look like a TikTok, YouTube, or Instagram video URL." },
      { status: 422 }
    );
  }

  try {
    const meta = await fetchMeta(url);

    let transcript: TranscriptResult;
    let source: "whisper" | "captions";

    if (process.env.OPENAI_API_KEY) {
      const audio = await downloadAudio(url);
      transcript = await transcribeWithWhisper(audio);
      source = "whisper";
    } else if (platform === "youtube") {
      const captions = await fetchYoutubeCaptions(url);
      if (!captions) {
        return NextResponse.json(
          {
            error:
              "No OPENAI_API_KEY is configured and this YouTube video has no captions to fall back on.",
          },
          { status: 422 }
        );
      }
      transcript = {
        text: captions.segments.map((s) => s.text).join(" "),
        language: null,
        segments: captions.segments,
      };
      source = "captions";
    } else {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not configured. TikTok and Instagram transcription requires Whisper — add the key to your environment.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ platform, meta, transcript, source });
  } catch (err) {
    if (err instanceof TranscribeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("transcribe failed:", err);
    return NextResponse.json(
      { error: "Something went wrong while transcribing. Try again." },
      { status: 500 }
    );
  }
}

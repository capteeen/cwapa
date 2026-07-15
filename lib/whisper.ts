import { TranscribeError } from "./ytdlp";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  language: string | null;
  segments: TranscriptSegment[];
}

const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

export async function transcribeWithWhisper(audio: Buffer): Promise<TranscriptResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new TranscribeError("OPENAI_API_KEY is not configured on the server.", 500);
  }
  if (audio.byteLength > WHISPER_MAX_BYTES) {
    throw new TranscribeError(
      "Extracted audio exceeds the 25 MB Whisper limit. Try a shorter video.",
      422
    );
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", process.env.WHISPER_MODEL || "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new TranscribeError("The OpenAI API key was rejected — check OPENAI_API_KEY.", 500);
    }
    throw new TranscribeError(`Transcription service error (${res.status}): ${body.slice(0, 300)}`, 502);
  }

  const data = await res.json();
  const segments: TranscriptSegment[] = (data.segments ?? []).map(
    (s: { start: number; end: number; text: string }) => ({
      start: s.start,
      end: s.end,
      text: String(s.text ?? "").trim(),
    })
  );

  return {
    text: String(data.text ?? "").trim(),
    language: data.language ?? null,
    segments,
  };
}

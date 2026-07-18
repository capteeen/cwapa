import { TranscribeError } from "./ytdlp";

/**
 * Summarize a transcript with an OpenAI-compatible chat endpoint. Reuses the
 * transcription key; when Whisper points at Groq, the free Groq LLMs are used.
 */
export async function summarizeTranscript(text: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new TranscribeError("OPENAI_API_KEY is not configured on the server.", 500);
  }
  const isGroq = (process.env.WHISPER_API_URL ?? "").includes("groq.com");
  const url =
    process.env.LLM_API_URL ||
    (isGroq
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions");
  const model =
    process.env.LLM_MODEL || (isGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini");

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
            "You summarize video transcripts. Reply with: a 2-3 sentence overview, then 3-6 bullet points of key takeaways. Use the transcript's language. No preamble.",
        },
        // ~8k tokens of transcript is plenty for a faithful summary.
        { role: "user", content: text.slice(0, 32_000) },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new TranscribeError(
      `Summary service error (${res.status}): ${body.slice(0, 200)}`,
      502
    );
  }
  const data = await res.json();
  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    throw new TranscribeError("The summary service returned an empty response.", 502);
  }
  return summary;
}

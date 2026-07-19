import { TranscribeError } from "./ytdlp";
import { TRANSLATION_LANGUAGE_NAMES } from "./languages";

export async function translateTranscript(
  text: string,
  targetLanguage: string
): Promise<string> {
  const language = TRANSLATION_LANGUAGE_NAMES[targetLanguage];
  if (!language) {
    throw new TranscribeError("That translation language is not supported.", 400);
  }

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
          content: `Translate the supplied video transcript into ${language}. Preserve paragraph breaks, meaning, tone, names, numbers, and URLs. Return only the translation, with no preamble or commentary.`,
        },
        { role: "user", content: text.slice(0, 32_000) },
      ],
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new TranscribeError(
      `Translation service error (${res.status}): ${body.slice(0, 200)}`,
      502
    );
  }

  const data = await res.json();
  const translation = data.choices?.[0]?.message?.content?.trim();
  if (!translation) {
    throw new TranscribeError("The translation service returned an empty response.", 502);
  }
  return translation;
}

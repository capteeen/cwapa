export class RepurposeError extends Error {
  status: number;
  constructor(message: string, status = 500) { super(message); this.status = status; }
}

export const REPURPOSE_FORMATS = ["tiktok", "x", "linkedin", "hooks", "titles"] as const;
export type RepurposeFormat = (typeof REPURPOSE_FORMATS)[number];
export interface RepurposeResult { tiktok: string; x: string[]; linkedin: string; hooks: string[]; titles: string[]; }

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 12) : [];
}

export function parseRepurposeResponse(raw: string): RepurposeResult {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let value: Record<string, unknown>;
  try { value = JSON.parse(cleaned); } catch { throw new RepurposeError("The content service returned an invalid response. Try again.", 502); }
  const result = { tiktok: String(value.tiktok ?? "").trim(), x: stringList(value.x), linkedin: String(value.linkedin ?? "").trim(), hooks: stringList(value.hooks), titles: stringList(value.titles) };
  if (!result.tiktok && !result.linkedin && !result.x.length && !result.hooks.length && !result.titles.length) throw new RepurposeError("The content service returned an empty response.", 502);
  return result;
}

export async function repurposeTranscript(transcript: string, selected: RepurposeFormat[] = [...REPURPOSE_FORMATS]): Promise<RepurposeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new RepurposeError("OPENAI_API_KEY is not configured on the server.", 500);
  const requested = REPURPOSE_FORMATS.filter((format) => selected.includes(format));
  const isGroq = (process.env.WHISPER_API_URL ?? "").includes("groq.com");
  const url = process.env.LLM_API_URL || (isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions");
  const model = process.env.LLM_MODEL || (isGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini");
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, response_format: { type: "json_object" }, temperature: 0.65, messages: [
    { role: "system", content: `You are cwapa's senior social content editor. Preserve facts, names, numbers, links, and the speaker's voice. Never invent claims. Return valid JSON only with exactly: tiktok (caption plus 3-5 hashtags), x (5-10 posts under 280 characters), linkedin (one polished post), hooks (8 short hooks), titles (8 titles). Return empty values for unrequested formats. Requested: ${requested.join(", ")}.` },
    { role: "user", content: transcript.slice(0, 32_000) },
  ] }) });
  if (!response.ok) { const detail = await response.text().catch(() => ""); throw new RepurposeError(`Content service error (${response.status}): ${detail.slice(0, 180)}`, 502); }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new RepurposeError("The content service returned an empty response.", 502);
  return parseRepurposeResponse(content);
}

import { getInsForgeBrowserClient } from "./insforge";
import type { TranscriptSegment } from "./whisper";

export interface SaveProjectInput {
  title: string;
  sourceUrl: string;
  platform: string | null;
  durationSeconds: number;
  thumbnailUrl: string | null;
  language: string | null;
  text: string;
  segments: TranscriptSegment[];
}

export async function saveTranscriptProject(input: SaveProjectInput): Promise<string> {
  const client = getInsForgeBrowserClient();
  const { data: userData, error: userError } = await client.auth.getCurrentUser();
  if (userError || !userData?.user) {
    throw new Error("Sign in to save this transcript to your library.");
  }

  const { data, error } = await client.database.rpc("save_project", {
    project_title: input.title,
    project_source_url: input.sourceUrl,
    project_platform: input.platform,
    project_duration_seconds: input.durationSeconds,
    project_thumbnail_url: input.thumbnailUrl,
    transcript_language: input.language,
    transcript_text: input.text,
    transcript_segments: input.segments,
  });
  if (error) throw error;
  if (typeof data === "string") return data;
  if (Array.isArray(data) && typeof data[0] === "string") return data[0];
  return String((data as any)?.id ?? data ?? "");
}

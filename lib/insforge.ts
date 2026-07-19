import { createBrowserClient } from "@insforge/sdk/ssr";

export interface FolderRecord {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectRecord {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  source_url: string;
  platform: string | null;
  status: "ready" | "processing" | "failed";
  duration_seconds: number;
  thumbnail_url: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptRecord {
  id: string;
  project_id: string;
  user_id: string;
  full_text: string;
  language: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptSegmentRecord {
  id: number;
  project_id: string;
  transcript_id: string;
  user_id: string;
  position: number;
  start_seconds: number;
  end_seconds: number;
  text: string;
}

export function isInsForgeConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_INSFORGE_URL &&
      process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY
  );
}

export function getInsForgeBrowserClient() {
  if (!isInsForgeConfigured()) {
    throw new Error("The cwapa account service is not configured yet.");
  }
  return createBrowserClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });
}

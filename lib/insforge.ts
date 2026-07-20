import { createBrowserClient } from "@insforge/sdk/ssr";

declare global {
  interface Window {
    __CWAPA_CONFIG__?: {
      insforgeUrl?: string;
      insforgeAnonKey?: string;
    };
  }
}

function publicConfig() {
  if (typeof window !== "undefined" && window.__CWAPA_CONFIG__) {
    return {
      baseUrl: window.__CWAPA_CONFIG__.insforgeUrl,
      anonKey: window.__CWAPA_CONFIG__.insforgeAnonKey,
    };
  }
  return {
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  };
}

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
  const config = publicConfig();
  return Boolean(config.baseUrl && config.anonKey);
}

export function getInsForgeBrowserClient() {
  const config = publicConfig();
  if (!config.baseUrl || !config.anonKey) {
    throw new Error("The cwapa account service is not configured yet.");
  }
  return createBrowserClient({
    baseUrl: config.baseUrl,
    anonKey: config.anonKey,
  });
}

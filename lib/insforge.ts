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

export type RenderJobStatus = "queued" | "leased" | "processing" | "retrying" | "succeeded" | "failed" | "cancelled";

export interface RenderJobRecord {
  id: string;
  project_id: string | null;
  title: string;
  status: RenderJobStatus;
  progress: number;
  attempt_count: number;
  max_attempts: number;
  output_url: string | null;
  output_bytes: number | null;
  error_message: string | null;
  credit_refunded: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface UsageAccountRecord {
  credits_available: number;
  lifetime_credits_used: number;
  lifetime_credits_refunded: number;
  updated_at: string;
}

export interface UsageLedgerRecord {
  id: number;
  job_id: string | null;
  kind: "render_reserved" | "render_refunded" | "manual_adjustment";
  credit_delta: number;
  description: string;
  created_at: string;
}

export interface ProjectVersionRecord {
  id: string;
  project_id: string;
  version_number: number;
  source_revision: number;
  reason: "autosave" | "manual" | "before_restore" | "render";
  segments: Array<{ start: number; end: number; text: string }>;
  style: Record<string, unknown>;
  created_at: string;
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

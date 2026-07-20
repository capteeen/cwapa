import { cookies } from "next/headers";
import { createAdminClient } from "@insforge/sdk";
import { createServerClient } from "@insforge/sdk/ssr";

function publicConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  if (!baseUrl || !anonKey) throw new Error("InsForge is not configured.");
  return { baseUrl, anonKey };
}

export async function getInsForgeServerClient() {
  return createServerClient({ ...publicConfig(), cookies: await cookies() });
}

export function getInsForgeAdminClient() {
  const baseUrl = process.env.INSFORGE_URL || process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("The render worker admin client is not configured.");
  return createAdminClient({ baseUrl, apiKey, timeout: 30_000, retryCount: 3 });
}

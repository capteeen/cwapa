"use server";

import { cookies } from "next/headers";
import { createAuthActions, createServerClient } from "@insforge/sdk/ssr";
import { isInsForgeConfigured } from "@/lib/insforge";

export interface AuthActionResult {
  ok: boolean;
  message?: string;
  verificationRequired?: boolean;
  verificationMethod?: "code" | "link";
}

function config() {
  return {
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  };
}

function message(error: any, fallback: string): string {
  return String(error?.message ?? fallback);
}

export async function signInAction(email: string, password: string): Promise<AuthActionResult> {
  if (!isInsForgeConfigured()) return { ok: false, message: "Accounts are not configured yet." };
  const auth = createAuthActions({ ...config(), cookies: await cookies() });
  const { data, error } = await auth.signInWithPassword({ email, password });
  return error || !data?.user
    ? { ok: false, message: message(error, "Sign in failed.") }
    : { ok: true };
}

export async function signUpAction(
  name: string,
  email: string,
  password: string
): Promise<AuthActionResult> {
  if (!isInsForgeConfigured()) return { ok: false, message: "Accounts are not configured yet." };
  const auth = createAuthActions({ ...config(), cookies: await cookies() });
  const redirectTo = new URL("/auth?verified=1", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString();
  const { data, error } = await auth.signUp({ email, password, name, redirectTo });
  if (error || !data) return { ok: false, message: message(error, "Account creation failed.") };
  if (data.requireEmailVerification) {
    return {
      ok: true,
      verificationRequired: true,
      verificationMethod: "code",
    };
  }
  return { ok: true };
}

export async function verifyEmailAction(email: string, otp: string): Promise<AuthActionResult> {
  if (!isInsForgeConfigured()) return { ok: false, message: "Accounts are not configured yet." };
  const auth = createAuthActions({ ...config(), cookies: await cookies() });
  const { data, error } = await auth.verifyEmail({ email, otp });
  return error || !data?.user
    ? { ok: false, message: message(error, "That verification code is invalid or expired.") }
    : { ok: true };
}

export async function signOutAction(): Promise<AuthActionResult> {
  if (!isInsForgeConfigured()) return { ok: true };
  const auth = createAuthActions({ ...config(), cookies: await cookies() });
  const { error } = await auth.signOut();
  return error ? { ok: false, message: message(error, "Sign out failed.") } : { ok: true };
}

export async function requestPasswordResetAction(email: string): Promise<AuthActionResult> {
  if (!isInsForgeConfigured()) return { ok: false, message: "Accounts are not configured yet." };
  const client = createServerClient({ ...config(), cookies: await cookies() });
  const { error } = await client.auth.sendResetPasswordEmail({ email });
  return error
    ? { ok: false, message: message(error, "Could not send the reset email.") }
    : { ok: true, message: "Enter the six-digit code sent to your email." };
}

export async function resetPasswordWithCodeAction(
  email: string,
  code: string,
  newPassword: string
): Promise<AuthActionResult> {
  if (!isInsForgeConfigured()) return { ok: false, message: "Accounts are not configured yet." };
  const client = createServerClient({ ...config(), cookies: await cookies() });
  const exchanged = await client.auth.exchangeResetPasswordToken({ email, code });
  if (exchanged.error || !exchanged.data?.token) {
    return { ok: false, message: message(exchanged.error, "That reset code is invalid or expired.") };
  }
  const { error } = await client.auth.resetPassword({ otp: exchanged.data.token, newPassword });
  return error
    ? { ok: false, message: message(error, "Could not reset the password.") }
    : { ok: true, message: "Password updated. You can sign in now." };
}

export async function resetPasswordAction(token: string, newPassword: string): Promise<AuthActionResult> {
  if (!isInsForgeConfigured()) return { ok: false, message: "Accounts are not configured yet." };
  const client = createServerClient({ ...config(), cookies: await cookies() });
  const { error } = await client.auth.resetPassword({ otp: token, newPassword });
  return error
    ? { ok: false, message: message(error, "Could not reset the password.") }
    : { ok: true, message: "Password updated. You can sign in now." };
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  requestPasswordResetAction,
  resetPasswordWithCodeAction,
  signInAction,
  signUpAction,
  verifyEmailAction,
} from "@/app/auth/actions";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset-code" | "verify" | "check-email";

export default function AuthPanel({ next = "/library", verified = false }: { next?: string; verified?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string | null>(
    verified ? "Email verified. Sign in to continue." : null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result =
        mode === "sign-in"
          ? await signInAction(email, password)
          : mode === "sign-up"
            ? await signUpAction(name, email, password)
            : mode === "verify"
              ? await verifyEmailAction(email, otp)
              : mode === "reset-code"
                ? await resetPasswordWithCodeAction(email, otp, password)
                : await requestPasswordResetAction(email);

      if (!result.ok) {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      if (mode === "sign-up" && result.verificationRequired) {
        setMode(result.verificationMethod === "link" ? "check-email" : "verify");
        return;
      }
      if (mode === "forgot") {
        setMessage(result.message ?? "Check your email.");
        setMode("reset-code");
        return;
      }
      if (mode === "reset-code") {
        setMessage(result.message ?? "Password updated.");
        setMode("sign-in");
        setPassword("");
        setOtp("");
        return;
      }
      router.push(next.startsWith("/") ? next : "/library");
      router.refresh();
    });
  }

  const title =
    mode === "sign-up"
      ? "Create your workspace"
      : mode === "forgot"
        ? "Reset your password"
        : mode === "reset-code"
          ? "Enter your reset code"
        : mode === "verify"
          ? "Check your inbox"
          : mode === "check-email"
            ? "One last step"
            : "Welcome back";

  return (
    <div className="mx-auto w-full max-w-md rounded-[28px] border border-hairline/70 bg-white p-7 shadow-[0_30px_90px_-45px_rgba(29,29,31,0.35)] sm:p-9">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        {mode === "sign-up"
          ? "Save transcripts, organize projects, and pick up where you left off."
          : mode === "forgot"
            ? "We’ll send a secure six-digit code to your email."
            : mode === "reset-code"
              ? `Enter the code sent to ${email}, then choose a new password.`
            : mode === "verify"
              ? `Enter the 6-digit code sent to ${email}.`
              : mode === "check-email"
                ? `Open the verification link sent to ${email}, then return to sign in.`
                : "Your projects and transcripts are waiting."}
      </p>

      {mode !== "check-email" && (
        <form onSubmit={submit} className="mt-7 space-y-3">
          {mode === "sign-up" && (
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" required className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[14px] outline-none focus:ring-2 focus:ring-accent/30" />
          )}
          {mode !== "verify" && mode !== "reset-code" && (
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" autoComplete="email" required className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[14px] outline-none focus:ring-2 focus:ring-accent/30" />
          )}
          {mode === "verify" || mode === "reset-code" ? (
            <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" autoComplete="one-time-code" required minLength={6} className="w-full rounded-2xl bg-surface px-4 py-4 text-center font-mono text-2xl tracking-[0.35em] outline-none focus:ring-2 focus:ring-accent/30" />
          ) : mode !== "forgot" ? (
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} required minLength={8} className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[14px] outline-none focus:ring-2 focus:ring-accent/30" />
          ) : null}
          {mode === "reset-code" && (
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" autoComplete="new-password" required minLength={8} className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[14px] outline-none focus:ring-2 focus:ring-accent/30" />
          )}
          <button type="submit" disabled={pending} className="w-full rounded-full bg-ink px-5 py-3.5 text-[14px] font-semibold text-white transition hover:bg-black disabled:opacity-40">
            {pending ? "Working…" : mode === "sign-up" ? "Create account" : mode === "forgot" ? "Send reset code" : mode === "reset-code" ? "Update password" : mode === "verify" ? "Verify email" : "Sign in"}
          </button>
        </form>
      )}

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[12px] text-red-600">{error}</p>}
      {message && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-[12px] text-emerald-700">{message}</p>}

      <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[12px] text-muted">
        {mode !== "sign-in" && <button onClick={() => { setMode("sign-in"); setError(null); }} className="hover:text-ink">Back to sign in</button>}
        {mode === "sign-in" && <><button onClick={() => setMode("sign-up")} className="hover:text-ink">Create account</button><button onClick={() => setMode("forgot")} className="hover:text-ink">Forgot password?</button></>}
      </div>
    </div>
  );
}

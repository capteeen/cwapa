"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/app/auth/actions";

export default function ResetPasswordPanel({ token }: { token?: string }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    startTransition(async () => {
      const result = await resetPasswordAction(token, password);
      if (result.ok) setMessage(result.message ?? "Password updated.");
      else setError(result.message ?? "Could not update the password.");
    });
  }

  return (
    <div className="mx-auto max-w-md rounded-[28px] border border-hairline/70 bg-white p-8 shadow-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      {!token ? <p className="mt-4 text-[14px] text-red-600">This reset link is incomplete or expired.</p> : <form onSubmit={submit} className="mt-6 space-y-3"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" placeholder="New password" className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[14px] outline-none focus:ring-2 focus:ring-accent/30" /><button disabled={pending} className="w-full rounded-full bg-ink py-3.5 text-[14px] font-semibold text-white disabled:opacity-40">{pending ? "Updating…" : "Update password"}</button></form>}
      {error && <p className="mt-4 text-[12px] text-red-600">{error}</p>}
      {message && <p className="mt-4 text-[12px] text-emerald-700">{message}</p>}
      <Link href="/auth" className="mt-6 inline-block text-[12px] font-medium text-accent">Return to sign in →</Link>
    </div>
  );
}

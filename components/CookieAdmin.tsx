"use client";

import { useState } from "react";

export default function CookieAdmin() {
  const [token, setToken] = useState("");
  const [cookies, setCookies] = useState("");
  const [status, setStatus] = useState<
    { kind: "idle" | "ok" | "error"; message: string }
  >({ kind: "idle", message: "" });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!token.trim() || !cookies.trim() || saving) return;
    setSaving(true);
    setStatus({ kind: "idle", message: "" });
    try {
      const res = await fetch("/api/admin/cookies", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "x-admin-token": token.trim(),
        },
        body: cookies,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? `Failed (${res.status}).` });
      } else {
        setStatus({
          kind: "ok",
          message: "Cookies updated. YouTube downloads should work again.",
        });
        setCookies("");
      }
    } catch {
      setStatus({ kind: "error", message: "Could not reach the server." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Admin token"
        className="w-full rounded-xl bg-surface px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-accent/40"
      />
      <textarea
        value={cookies}
        onChange={(e) => setCookies(e.target.value)}
        placeholder="Paste the full contents of cookies.txt here…"
        rows={10}
        spellCheck={false}
        className="w-full resize-y rounded-xl bg-surface px-4 py-3 font-mono text-[12px] outline-none focus:ring-2 focus:ring-accent/40"
      />
      <button
        onClick={save}
        disabled={saving || !token.trim() || !cookies.trim()}
        className="rounded-full bg-accent px-8 py-3 text-[15px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-30"
      >
        {saving ? "Saving…" : "Update cookies"}
      </button>

      {status.kind === "ok" && (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-center text-[13px] text-green-700">
          {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-[13px] text-red-600">
          {status.message}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

export default function CookieAdmin() {
  const [token, setToken] = useState("");
  const [cookies, setCookies] = useState("");
  const [status, setStatus] = useState<
    { kind: "idle" | "ok" | "error"; message: string }
  >({ kind: "idle", message: "" });
  const [saving, setSaving] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);

  async function diagnose() {
    if (!token.trim() || diagnosing) return;
    setDiagnosing(true);
    setDiagnosis(null);
    try {
      const res = await fetch("/api/admin/diagnose", {
        headers: { "x-admin-token": token.trim() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDiagnosis(`Error (${res.status}): ${data.error ?? "failed"}`);
      } else {
        const p = data.config.proxy.configured
          ? `Proxy: ON — ${data.config.proxy.endpoint}`
          : "Proxy: OFF (YT_DLP_PROXY not set in this build)";
        const c = data.config.cookies.configured
          ? "Cookies: ON"
          : "Cookies: OFF";
        const eg = data.egress ?? {};
        const egLines: string[] = [];
        egLines.push(`Server IP (direct): ${eg.direct ?? "unknown"}`);
        if (data.config.proxy.configured) {
          if (eg.throughProxy) {
            const routed = eg.throughProxy !== eg.direct;
            egLines.push(
              `Server IP (via proxy): ${eg.throughProxy} ${
                routed ? "✅ proxy IS routing" : "⚠️ same as direct — proxy NOT routing"
              }`
            );
          } else {
            egLines.push(`Server IP (via proxy): FAILED — ${eg.proxyError ?? "no response"}`);
          }
        }
        const u = data.config.usage;
        const uLine = u
          ? `Proxy usage (${u.month}): ${u.gb} GB${
              u.capGB ? ` of ${u.capGB} GB budget (${u.pct}%)` : ""
            }`
          : "";
        const t = data.test.ok
          ? `✅ Live YouTube test PASSED — fetched "${data.test.title}" (${data.tookMs} ms)`
          : `❌ Live YouTube test FAILED — ${data.test.error}`;
        setDiagnosis([p, c, ...egLines, uLine, t].filter(Boolean).join("\n"));
      }
    } catch {
      setDiagnosis("Could not reach the server.");
    } finally {
      setDiagnosing(false);
    }
  }

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

      <div className="mt-6 border-t border-hairline/60 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold">Diagnostics</h2>
            <p className="text-[12px] text-muted">
              Check what&apos;s live in the running app and test YouTube.
            </p>
          </div>
          <button
            onClick={diagnose}
            disabled={diagnosing || !token.trim()}
            className="rounded-full border border-hairline px-4 py-2 text-[13px] font-medium text-ink transition hover:border-accent disabled:opacity-30"
          >
            {diagnosing ? "Testing…" : "Run diagnostic"}
          </button>
        </div>
        {diagnosis && (
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-surface px-4 py-3 text-[12px] leading-relaxed text-ink">
            {diagnosis}
          </pre>
        )}
      </div>
    </div>
  );
}

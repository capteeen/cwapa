"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RenderJobRecord, UsageAccountRecord, UsageLedgerRecord } from "@/lib/insforge";

interface DashboardData {
  jobs: RenderJobRecord[];
  account: UsageAccountRecord | null;
  ledger: UsageLedgerRecord[];
}

const statusTone: Record<string, string> = {
  queued: "bg-amber-50 text-amber-700", leased: "bg-blue-50 text-blue-700",
  processing: "bg-blue-50 text-blue-700", retrying: "bg-orange-50 text-orange-700",
  succeeded: "bg-emerald-50 text-emerald-700", failed: "bg-red-50 text-red-700",
  cancelled: "bg-neutral-100 text-neutral-500",
};

function bytes(value: number | null) {
  if (!value) return "—";
  return value >= 1e9 ? `${(value / 1e9).toFixed(1)} GB` : `${(value / 1e6).toFixed(1)} MB`;
}

export default function ReliabilityDashboard() {
  const [data, setData] = useState<DashboardData>({ jobs: [], account: null, ledger: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/render-jobs", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load usage.");
      setData(result);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load usage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const active = useMemo(() => data.jobs.some((job) => ["queued", "leased", "processing", "retrying"].includes(job.status)), [data.jobs]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void load(), 3_000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  if (loading) return <div className="h-96 animate-pulse rounded-[32px] bg-surface" />;

  const account = data.account ?? { credits_available: 10, lifetime_credits_used: 0, lifetime_credits_refunded: 0, updated_at: new Date().toISOString() };
  const completed = data.jobs.filter((job) => job.status === "succeeded").length;
  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-accent">Reliability center</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">Usage and render history.</h1><p className="mt-3 max-w-xl text-[14px] leading-6 text-muted">Every render is resumable, retried automatically, and refunded if all attempts fail.</p></div>
        <Link href="/studio" className="w-fit rounded-full bg-ink px-6 py-3 text-[12px] font-semibold text-white">New render</Link>
      </div>

      {error && <p className="mt-6 rounded-2xl bg-red-50 p-4 text-[13px] text-red-600">{error}</p>}
      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          ["Credits available", account.credits_available, "Ready for future renders"],
          ["Successful renders", completed, `${account.lifetime_credits_used} credits reserved`],
          ["Credits refunded", account.lifetime_credits_refunded, "Returned automatically"],
        ].map(([label, value, detail]) => <div key={label} className="rounded-[26px] border border-hairline/60 bg-white p-6"><p className="text-[11px] text-muted">{label}</p><p className="mt-3 text-4xl font-semibold tracking-[-.05em]">{value}</p><p className="mt-2 text-[11px] text-muted">{detail}</p></div>)}
      </section>

      <section className="mt-8 overflow-hidden rounded-[28px] border border-hairline/60 bg-white">
        <div className="flex items-center justify-between border-b border-hairline/60 px-6 py-5"><div><h2 className="text-[16px] font-semibold">Render history</h2><p className="mt-1 text-[11px] text-muted">Jobs survive refreshes and server restarts.</p></div>{active && <span className="flex items-center gap-2 text-[11px] text-blue-600"><span className="h-2 w-2 animate-pulse rounded-full bg-blue-500"/>Processing</span>}</div>
        {data.jobs.length === 0 ? <div className="p-12 text-center text-[13px] text-muted">Your first background render will appear here.</div> : <div className="divide-y divide-hairline/50">{data.jobs.map((job) => <article key={job.id} className="grid gap-4 px-6 py-5 sm:grid-cols-[minmax(0,1fr)_120px_110px_auto] sm:items-center"><div className="min-w-0"><p className="truncate text-[13px] font-semibold">{job.title}</p><p className="mt-1 text-[10px] text-muted">{new Date(job.created_at).toLocaleString()} · attempt {job.attempt_count}/{job.max_attempts}</p>{job.error_message && <p className="mt-2 truncate text-[10px] text-red-500">{job.error_message}</p>}</div><div><span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold capitalize ${statusTone[job.status]}`}>{job.status}</span>{["queued","leased","processing","retrying"].includes(job.status) && <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface"><div className="h-full bg-accent transition-all" style={{ width: `${job.progress}%` }}/></div>}</div><p className="text-[11px] text-muted">{bytes(job.output_bytes)}</p><div>{job.status === "succeeded" ? <a href={`/api/render-jobs/${job.id}/download`} className="rounded-full bg-ink px-4 py-2 text-[11px] font-semibold text-white">Download</a> : job.credit_refunded ? <span className="text-[10px] font-medium text-emerald-600">Credit refunded</span> : null}</div></article>)}</div>}
      </section>

      <section className="mt-8 rounded-[28px] border border-hairline/60 bg-white p-6"><h2 className="text-[16px] font-semibold">Credit activity</h2><div className="mt-5 space-y-3">{data.ledger.length === 0 ? <p className="text-[12px] text-muted">No credit activity yet.</p> : data.ledger.slice(0, 10).map((entry) => <div key={entry.id} className="flex items-center justify-between text-[12px]"><div><p>{entry.description}</p><p className="mt-0.5 text-[10px] text-muted">{new Date(entry.created_at).toLocaleString()}</p></div><span className={entry.credit_delta > 0 ? "font-semibold text-emerald-600" : "font-semibold text-ink"}>{entry.credit_delta > 0 ? "+" : ""}{entry.credit_delta}</span></div>)}</div></section>
    </div>
  );
}

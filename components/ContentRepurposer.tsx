"use client";

import { useEffect, useMemo, useState } from "react";
import { REPURPOSE_FORMATS, type RepurposeFormat, type RepurposeResult } from "@/lib/repurpose";

const labels: Record<RepurposeFormat, [string, string]> = { tiktok: ["TikTok caption", "Short-form"], x: ["X thread", "Conversation"], linkedin: ["LinkedIn post", "Professional"], hooks: ["Hooks", "Attention"], titles: ["Titles", "Discovery"] };

export default function ContentRepurposer() {
  const [transcript, setTranscript] = useState("");
  const [selected, setSelected] = useState<RepurposeFormat[]>([...REPURPOSE_FORMATS]);
  const [result, setResult] = useState<RepurposeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const words = useMemo(() => transcript.trim() ? transcript.trim().split(/\s+/).length : 0, [transcript]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem("cwapa:repurpose-transcript");
    if (saved) { setTranscript(saved); window.sessionStorage.removeItem("cwapa:repurpose-transcript"); }
  }, []);

  function toggle(format: RepurposeFormat) { setSelected((current) => current.includes(format) ? current.filter((item) => item !== format) : [...current, format]); }
  async function generate() {
    setLoading(true); setError(null);
    try { const response = await fetch("/api/repurpose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript, formats: selected }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Generation failed."); setResult(data.content); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Generation failed."); }
    finally { setLoading(false); }
  }
  async function copy(key: string, value: string) { await navigator.clipboard.writeText(value); setCopied(key); window.setTimeout(() => setCopied(null), 1400); }
  function update(key: string, value: string) { setResult((current) => current ? { ...current, [key]: key === "x" ? value.split(/\n\n+/).map((item) => item.replace(/^\d+\/\d+\s*/, "")) : key === "hooks" || key === "titles" ? value.split("\n").map((item) => item.replace(/^\d+\.\s*/, "")) : value } : current); }
  const outputs = result ? [
    { key: "tiktok", text: result.tiktok }, { key: "x", text: result.x.map((item, i) => `${i + 1}/${result.x.length} ${item}`).join("\n\n") },
    { key: "linkedin", text: result.linkedin }, { key: "hooks", text: result.hooks.map((item, i) => `${i + 1}. ${item}`).join("\n") }, { key: "titles", text: result.titles.map((item, i) => `${i + 1}. ${item}`).join("\n") },
  ].filter((item) => item.text) : [];

  return <div className="mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-[.88fr_1.12fr]">
    <section className="rounded-[30px] border border-hairline/70 bg-white p-5 shadow-[0_35px_100px_-55px_rgba(29,29,31,.4)] sm:p-7 lg:sticky lg:top-24 lg:self-start">
      <div className="flex justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-accent">Source</p><h2 className="mt-1 text-xl font-semibold">Your transcript</h2></div><span className="h-fit rounded-full bg-surface px-3 py-1 text-[11px] text-muted">{words.toLocaleString()} words</span></div>
      <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Paste a transcript here. The more context you include, the sharper your content becomes." className="mt-5 min-h-[310px] w-full resize-y rounded-[22px] border border-hairline/70 bg-[#fbfbfd] p-5 text-[14px] leading-7 outline-none transition focus:border-accent/30 focus:ring-4 focus:ring-accent/[.06]" />
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[.16em] text-muted">Create</p>
      <div className="mt-3 grid grid-cols-2 gap-2">{REPURPOSE_FORMATS.map((format) => { const active = selected.includes(format); return <button key={format} onClick={() => toggle(format)} className={`rounded-2xl border px-3 py-3 text-left transition ${active ? "border-ink bg-ink text-white" : "border-hairline text-muted hover:text-ink"}`}><span className="block text-[10px] uppercase tracking-wider opacity-60">{labels[format][1]}</span><span className="mt-0.5 block text-[13px] font-semibold">{labels[format][0]}</span></button>; })}</div>
      <button onClick={generate} disabled={loading || transcript.trim().length < 40 || !selected.length} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-4 text-[14px] font-semibold text-white shadow-[0_14px_30px_-14px_rgba(0,113,227,.8)] transition hover:bg-[#0067d2] disabled:opacity-40">{loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Shaping your content…</> : "Generate content"}</button>
      {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-[12px] text-red-600">{error}</p>}
    </section>
    <section className="min-h-[650px] rounded-[30px] border border-white/70 bg-[linear-gradient(145deg,#f6f8fb,#eef2f8)] p-5 sm:p-7">
      <div className="flex items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-accent">Output studio</p><h2 className="mt-1 text-2xl font-semibold">One idea. Every channel.</h2></div>{result && <span className="text-[11px] text-muted">{outputs.length} formats ready</span>}</div>
      {!result && !loading && <div className="flex min-h-[520px] items-center justify-center"><div className="max-w-sm text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-white text-2xl shadow-sm">✦</div><h3 className="mt-5 text-lg font-semibold">Your content suite appears here</h3><p className="mt-2 text-[13px] leading-6 text-muted">Paste the transcript once. cwapa adapts the message and pacing for each channel.</p></div></div>}
      {loading && <div className="grid min-h-[520px] place-items-center"><div className="text-center"><div className="relative mx-auto h-20 w-20"><span className="absolute inset-0 animate-ping rounded-full bg-accent/10" /><span className="absolute inset-3 animate-pulse rounded-[22px] bg-white shadow-lg" /><span className="absolute inset-0 grid place-items-center text-xl text-accent">✦</span></div><p className="mt-5 text-[13px] font-medium">Finding the strongest angles…</p></div></div>}
      {result && !loading && <div className="mt-6 grid gap-4">{outputs.map((output) => { const format = output.key as RepurposeFormat; return <article key={output.key} className="rounded-[24px] border border-white bg-white/90 p-5 shadow-[0_18px_50px_-36px_rgba(29,29,31,.45)]"><div className="flex justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-accent">{labels[format][1]}</p><h3 className="mt-1 font-semibold">{labels[format][0]}</h3></div><button onClick={() => copy(output.key, output.text)} className="h-fit rounded-full bg-surface px-3 py-2 text-[11px] font-semibold text-muted">{copied === output.key ? "Copied ✓" : "Copy"}</button></div><textarea value={output.text} onChange={(event) => update(output.key, event.target.value)} className="mt-4 min-h-[140px] w-full resize-y bg-transparent text-[13px] leading-6 outline-none" /></article>; })}</div>}
    </section>
  </div>;
}

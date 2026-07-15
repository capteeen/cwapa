"use client";

import { useMemo, useState } from "react";
import { detectPlatform, PLATFORM_LABELS, type Platform } from "@/lib/platform";
import { formatClock, toSrt } from "@/lib/format";
import type { TranscriptResult } from "@/lib/whisper";

interface ApiResponse {
  platform: Platform;
  meta: {
    title: string;
    uploader: string;
    durationSeconds: number;
    thumbnail: string | null;
    webpageUrl: string;
  };
  transcript: TranscriptResult;
  source: "whisper" | "captions";
}

const PLATFORM_BADGE: Record<Platform, string> = {
  youtube: "bg-red-500/15 text-red-300 border-red-500/30",
  tiktok: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  instagram: "bg-pink-500/15 text-pink-300 border-pink-500/30",
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [copied, setCopied] = useState(false);

  const platform = useMemo(() => detectPlatform(url), [url]);

  async function transcribe(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Transcription failed.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Could not reach the server. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  async function copyTranscript() {
    if (!result) return;
    const text = showTimestamps
      ? result.transcript.segments
          .map((s) => `[${formatClock(s.start)}] ${s.text}`)
          .join("\n")
      : result.transcript.text;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download(kind: "txt" | "srt") {
    if (!result) return;
    const content =
      kind === "srt" ? toSrt(result.transcript.segments) : result.transcript.text;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.meta.title.replace(/[^\w\d -]+/g, "").slice(0, 60) || "transcript"}.${kind}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-14">
      <header className="mb-10 text-center">
        <h1 className="text-5xl font-black tracking-tight">
          cwa<span className="text-accent-soft">pa</span>
        </h1>
        <p className="mt-3 text-zinc-400">
          Paste a TikTok, YouTube, or Instagram link — get a clean, timestamped
          transcript.
        </p>
      </header>

      <form onSubmit={transcribe} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@user/video/…"
            spellCheck={false}
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-4 py-3.5 pr-24 text-sm outline-none placeholder:text-zinc-600 focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
          {platform && (
            <span
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PLATFORM_BADGE[platform]}`}
            >
              {PLATFORM_LABELS[platform]}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Transcribing…" : "Transcribe"}
        </button>
      </form>

      {loading && (
        <div className="mt-10 flex flex-col items-center gap-3 text-zinc-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-accent" />
          <p className="text-sm">
            Fetching the video and transcribing the audio — longer videos take a
            bit…
          </p>
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <section className="mt-10">
          <div className="flex items-start gap-4 rounded-xl border border-ink-700 bg-ink-900 p-4">
            {result.meta.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.meta.thumbnail}
                alt=""
                className="hidden h-20 w-32 rounded-lg object-cover sm:block"
              />
            )}
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{result.meta.title}</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {result.meta.uploader} · {formatClock(result.meta.durationSeconds)}
                {result.transcript.language && ` · ${result.transcript.language}`}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {result.source === "whisper"
                  ? "Transcribed with Whisper"
                  : "From YouTube captions"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={copyTranscript}
              className="rounded-lg border border-ink-700 bg-ink-800 px-3.5 py-2 text-xs font-medium text-zinc-300 transition hover:border-accent/50"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button
              onClick={() => download("txt")}
              className="rounded-lg border border-ink-700 bg-ink-800 px-3.5 py-2 text-xs font-medium text-zinc-300 transition hover:border-accent/50"
            >
              Download .txt
            </button>
            <button
              onClick={() => download("srt")}
              disabled={result.transcript.segments.length === 0}
              className="rounded-lg border border-ink-700 bg-ink-800 px-3.5 py-2 text-xs font-medium text-zinc-300 transition hover:border-accent/50 disabled:opacity-40"
            >
              Download .srt
            </button>
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={showTimestamps}
                onChange={(e) => setShowTimestamps(e.target.checked)}
                className="accent-purple-500"
              />
              Timestamps
            </label>
          </div>

          <div className="mt-4 max-h-[28rem] overflow-y-auto rounded-xl border border-ink-700 bg-ink-900 p-5 leading-relaxed">
            {showTimestamps && result.transcript.segments.length > 0 ? (
              <div className="space-y-2.5">
                {result.transcript.segments.map((seg, i) => (
                  <p key={i} className="text-sm">
                    <span className="mr-3 select-none font-mono text-xs text-accent-soft/70">
                      {formatClock(seg.start)}
                    </span>
                    {seg.text}
                  </p>
                ))}
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{result.transcript.text}</p>
            )}
          </div>
        </section>
      )}

      <footer className="mt-auto pt-16 text-center text-xs text-zinc-600">
        cwapa · transcriber today, video agent tomorrow
      </footer>
    </main>
  );
}

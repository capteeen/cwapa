"use client";

import { useEffect, useMemo, useState } from "react";
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

interface HistoryItem {
  url: string;
  title: string;
  platform: Platform;
  at: number;
}

const PLATFORM_BADGE: Record<Platform, string> = {
  youtube: "bg-red-500/15 text-red-300 border-red-500/30",
  tiktok: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  instagram: "bg-pink-500/15 text-pink-300 border-pink-500/30",
};

const DOWNLOAD_FORMATS = [
  { value: "best", label: "MP4 · Best quality" },
  { value: "1080", label: "MP4 · 1080p" },
  { value: "720", label: "MP4 · 720p" },
  { value: "480", label: "MP4 · 480p" },
  { value: "mp3", label: "MP3 · Audio only" },
] as const;

const HISTORY_KEY = "cwapa.history";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dlFormat, setDlFormat] = useState<string>("best");
  const [preparing, setPreparing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const platform = useMemo(() => detectPlatform(url), [url]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* corrupted history is not worth surfacing */
    }
  }, []);

  function pushHistory(item: HistoryItem) {
    setHistory((prev) => {
      const next = [item, ...prev.filter((h) => h.url !== item.url)].slice(0, 8);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* storage full/blocked — history is best-effort */
      }
      return next;
    });
  }

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
        pushHistory({
          url: url.trim(),
          title: data.meta.title,
          platform: data.platform,
          at: Date.now(),
        });
      }
    } catch {
      setError("Could not reach the server. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  function downloadMedia() {
    if (!url.trim() || preparing) return;
    setPreparing(true);
    setError(null);
    // Navigating to the endpoint hands the (potentially large) file transfer
    // to the browser's own download manager.
    window.location.href = `/api/download?url=${encodeURIComponent(url.trim())}&format=${dlFormat}`;
    setTimeout(() => setPreparing(false), 8000);
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
    <div className="flex min-h-screen flex-col">
      <nav className="sticky top-0 z-10 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <span className="text-xl font-black tracking-tight">
            cwa<span className="text-accent-soft">pa</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent-soft">
              beta
            </span>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-14">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Turn any video into <span className="text-accent-soft">text</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Paste a TikTok, YouTube, or Instagram link. Get a clean, timestamped
            transcript — or download the video and audio in the quality you want.
          </p>
        </header>

        <form onSubmit={transcribe} className="flex flex-col gap-3">
          <div className="relative">
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="flex-1 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Transcribing…" : "Transcribe"}
            </button>
            <div className="flex flex-1 gap-2">
              <select
                value={dlFormat}
                onChange={(e) => setDlFormat(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-900 px-3 py-3.5 text-sm text-zinc-300 outline-none focus:border-accent/60"
              >
                {DOWNLOAD_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={downloadMedia}
                disabled={!platform || preparing}
                className="rounded-xl border border-ink-700 bg-ink-800 px-5 py-3.5 text-sm font-semibold text-zinc-300 transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {preparing ? "Preparing…" : "Download"}
              </button>
            </div>
          </div>
        </form>

        {preparing && (
          <p className="mt-3 text-center text-xs text-zinc-500">
            Fetching and converting on the server — your browser&apos;s download
            will start in a moment.
          </p>
        )}

        {loading && (
          <div className="mt-10 flex flex-col items-center gap-3 text-zinc-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-accent" />
            <p className="text-sm">
              Fetching the video and transcribing the audio — longer videos take
              a bit…
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
                  {result.meta.uploader} ·{" "}
                  {formatClock(result.meta.durationSeconds)}
                  {result.transcript.language &&
                    ` · ${result.transcript.language}`}
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
                <p className="whitespace-pre-wrap text-sm">
                  {result.transcript.text}
                </p>
              )}
            </div>
          </section>
        )}

        {!result && !loading && history.length > 0 && (
          <section className="mt-12">
            <h3 className="mb-3 text-sm font-semibold text-zinc-400">Recent</h3>
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.url}>
                  <button
                    onClick={() => setUrl(h.url)}
                    className="flex w-full items-center gap-3 rounded-lg border border-ink-800 bg-ink-900/60 px-4 py-2.5 text-left transition hover:border-accent/40"
                  >
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${PLATFORM_BADGE[h.platform]}`}
                    >
                      {PLATFORM_LABELS[h.platform]}
                    </span>
                    <span className="truncate text-sm text-zinc-300">
                      {h.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!result && !loading && (
          <section className="mt-14 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Whisper transcripts",
                body: "Accurate, timestamped speech-to-text for any public video, in any language.",
              },
              {
                title: "MP4 & MP3 downloads",
                body: "Save the video at the quality you pick, or just the audio as an MP3.",
              },
              {
                title: "Subtitle-ready",
                body: "Export .srt files that drop straight into editors and video players.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-ink-800 bg-ink-900/60 p-5"
              >
                <h3 className="font-semibold text-zinc-200">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  {f.body}
                </p>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="border-t border-ink-800 py-6 text-center text-xs text-zinc-600">
        cwapa · transcriber today, video agent tomorrow
      </footer>
    </div>
  );
}

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
  youtube: "bg-red-50 text-red-600",
  tiktok: "bg-zinc-100 text-zinc-800",
  instagram: "bg-pink-50 text-pink-600",
};

const DOWNLOAD_FORMATS = [
  { value: "best", label: "MP4 · Best" },
  { value: "1080", label: "MP4 · 1080p" },
  { value: "720", label: "MP4 · 720p" },
  { value: "480", label: "MP4 · 480p" },
  { value: "mp3", label: "MP3 · Audio" },
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
      <nav className="sticky top-0 z-10 border-b border-hairline/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span className="text-lg font-semibold tracking-tight">cwapa</span>
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted">
            Beta
          </span>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-24 pt-20">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-[44px] sm:leading-tight">
            Turn any video into text.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-muted">
            Paste a TikTok, YouTube, or Instagram link. Get a clean transcript,
            or download the video or audio.
          </p>
        </header>

        <form onSubmit={transcribe} className="flex flex-col gap-3">
          <div className="relative">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a video link"
              spellCheck={false}
              className="w-full rounded-2xl bg-surface px-5 py-4 text-[15px] outline-none transition placeholder:text-muted focus:ring-2 focus:ring-accent/40"
            />
            {platform && (
              <span
                className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-xs font-medium ${PLATFORM_BADGE[platform]}`}
              >
                {PLATFORM_LABELS[platform]}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full rounded-full bg-accent px-8 py-3 text-[15px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto"
            >
              {loading ? "Transcribing…" : "Transcribe"}
            </button>
            <div className="flex w-full gap-2 sm:w-auto">
              <select
                value={dlFormat}
                onChange={(e) => setDlFormat(e.target.value)}
                className="flex-1 appearance-none rounded-full border border-hairline bg-white px-4 py-3 text-center text-[15px] text-ink outline-none transition focus:border-accent sm:flex-none"
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
                className="rounded-full border border-hairline bg-white px-6 py-3 text-[15px] font-medium text-accent transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-30"
              >
                {preparing ? "Preparing…" : "Download"}
              </button>
            </div>
          </div>
        </form>

        {preparing && (
          <p className="mt-4 text-center text-[13px] text-muted">
            Fetching and converting — your download will begin shortly.
          </p>
        )}

        {loading && (
          <div className="mt-14 flex flex-col items-center gap-4">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-surface border-t-accent" />
            <p className="text-[15px] text-muted">
              Transcribing — longer videos take a moment.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl bg-red-50 px-5 py-4 text-center text-[14px] text-red-600">
            {error}
          </div>
        )}

        {result && (
          <section className="mt-12">
            <div className="flex items-start gap-4 rounded-2xl bg-surface p-5">
              {result.meta.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.meta.thumbnail}
                  alt=""
                  className="hidden h-20 w-32 rounded-xl object-cover sm:block"
                />
              )}
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold">
                  {result.meta.title}
                </h2>
                <p className="mt-1 text-[13px] text-muted">
                  {result.meta.uploader} ·{" "}
                  {formatClock(result.meta.durationSeconds)}
                  {result.transcript.language &&
                    ` · ${result.transcript.language}`}
                </p>
                <p className="mt-1 text-[12px] text-muted/80">
                  {result.source === "whisper"
                    ? "Transcribed with Whisper"
                    : "From YouTube captions"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                onClick={copyTranscript}
                className="rounded-full bg-surface px-4 py-2 text-[13px] font-medium text-ink transition hover:bg-hairline/40"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <button
                onClick={() => download("txt")}
                className="rounded-full bg-surface px-4 py-2 text-[13px] font-medium text-ink transition hover:bg-hairline/40"
              >
                Text file
              </button>
              <button
                onClick={() => download("srt")}
                disabled={result.transcript.segments.length === 0}
                className="rounded-full bg-surface px-4 py-2 text-[13px] font-medium text-ink transition hover:bg-hairline/40 disabled:opacity-30"
              >
                Subtitles (.srt)
              </button>
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-[13px] text-muted">
                <input
                  type="checkbox"
                  checked={showTimestamps}
                  onChange={(e) => setShowTimestamps(e.target.checked)}
                  className="accent-[#0071e3]"
                />
                Timestamps
              </label>
            </div>

            <div className="mt-4 max-h-[30rem] overflow-y-auto rounded-2xl border border-hairline/60 p-6 leading-relaxed">
              {showTimestamps && result.transcript.segments.length > 0 ? (
                <div className="space-y-3">
                  {result.transcript.segments.map((seg, i) => (
                    <p key={i} className="text-[15px]">
                      <span className="mr-3 select-none font-mono text-[12px] text-accent/70">
                        {formatClock(seg.start)}
                      </span>
                      {seg.text}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-[15px]">
                  {result.transcript.text}
                </p>
              )}
            </div>
          </section>
        )}

        {!result && !loading && history.length > 0 && (
          <section className="mt-16">
            <h3 className="mb-3 text-center text-[13px] font-medium uppercase tracking-wide text-muted">
              Recent
            </h3>
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.url}>
                  <button
                    onClick={() => setUrl(h.url)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-surface px-5 py-3 text-left transition hover:bg-hairline/40"
                  >
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${PLATFORM_BADGE[h.platform]}`}
                    >
                      {PLATFORM_LABELS[h.platform]}
                    </span>
                    <span className="truncate text-[14px]">{h.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!result && !loading && (
          <section className="mt-16 grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Transcripts",
                body: "Accurate, timestamped speech-to-text in any language.",
              },
              {
                title: "Downloads",
                body: "Save the video in your chosen quality, or audio as MP3.",
              },
              {
                title: "Subtitles",
                body: "Export .srt files ready for editors and players.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl bg-surface p-6">
                <h3 className="text-[15px] font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                  {f.body}
                </p>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="border-t border-hairline/60 py-6 text-center text-[12px] text-muted">
        cwapa — transcriber today, video agent tomorrow
      </footer>
    </div>
  );
}

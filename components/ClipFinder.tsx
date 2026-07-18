"use client";

import { useState } from "react";
import { detectPlatform, PLATFORM_LABELS, type Platform } from "@/lib/platform";

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface Clip {
  start: number;
  end: number;
  title: string;
  reason: string;
  label: string;
}

const EXAMPLES = [
  "the strongest hook for a short",
  "when they explain the main idea",
  "a funny or surprising moment",
  "a bold or quotable statement",
];

export default function ClipFinder() {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState<{
    title: string;
    platform: Platform | null;
    segments: Segment[];
  } | null>(null);
  const [query, setQuery] = useState("");
  const [finding, setFinding] = useState(false);
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const platform = detectPlatform(url);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || analyzing) return;
    setAnalyzing(true);
    setError(null);
    setAnalyzed(null);
    setClips(null);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't analyze that video.");
      } else if (!data.transcript?.segments?.length) {
        setError("This video has no detectable speech to find clips in.");
      } else {
        setAnalyzed({
          title: data.meta.title,
          platform: data.platform,
          segments: data.transcript.segments,
        });
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function find(q: string) {
    if (!analyzed || !q.trim() || finding) return;
    setQuery(q);
    setFinding(true);
    setError(null);
    setClips(null);
    try {
      const res = await fetch("/api/find-clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim(), segments: analyzed.segments }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Clip search failed.");
      else setClips(data.clips);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setFinding(false);
    }
  }

  function downloadClip(clip: Clip, format: "mp4" | "mp3") {
    const key = `${clip.start}-${format}`;
    setDownloading(key);
    const params = new URLSearchParams({
      url: url.trim(),
      start: String(clip.start),
      end: String(clip.end),
      format,
    });
    window.location.href = `/api/clip?${params.toString()}`;
    setTimeout(() => setDownloading(null), 8000);
  }

  return (
    <div>
      <form onSubmit={analyze} className="flex flex-col gap-3">
        <div className="relative">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube, TikTok, or Instagram link"
            spellCheck={false}
            className="w-full rounded-2xl bg-surface px-5 py-4 text-[15px] outline-none transition placeholder:text-muted focus:ring-2 focus:ring-accent/40"
          />
          {platform && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-muted">
              {PLATFORM_LABELS[platform]}
            </span>
          )}
        </div>
        <div className="flex justify-center">
          <button
            type="submit"
            disabled={analyzing || !url.trim()}
            className="w-full rounded-full bg-accent px-8 py-3 text-[15px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto"
          >
            {analyzing ? "Analyzing video…" : analyzed ? "Analyze another" : "Analyze video"}
          </button>
        </div>
      </form>

      {analyzing && (
        <p className="mt-4 text-center text-[13px] text-muted">
          Watching the whole video so you don&apos;t have to — this takes a moment.
        </p>
      )}

      {error && (
        <div className="mt-8 rounded-2xl bg-red-50 px-5 py-4 text-center text-[14px] text-red-600">
          {error}
        </div>
      )}

      {analyzed && (
        <section className="mt-10">
          <p className="mb-3 text-center text-[13px] text-muted">
            Analyzed <span className="font-medium text-ink">{analyzed.title}</span>{" "}
            · describe the clip you want
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              find(query);
            }}
            className="relative"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. the most viral 30 seconds"
              className="w-full rounded-full bg-surface py-3.5 pl-5 pr-28 text-[15px] outline-none transition placeholder:text-muted focus:ring-2 focus:ring-accent/40"
            />
            <button
              type="submit"
              disabled={finding || !query.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-accent px-5 py-2 text-[14px] font-medium text-white transition hover:bg-accent-hover disabled:opacity-30"
            >
              {finding ? "Finding…" : "Find clips"}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => find(ex)}
                disabled={finding}
                className="rounded-full border border-hairline px-3 py-1 text-[12px] text-muted transition hover:border-accent hover:text-accent disabled:opacity-40"
              >
                {ex}
              </button>
            ))}
          </div>

          {clips && (
            <div className="mt-8 space-y-3">
              {clips.length === 0 && (
                <p className="py-4 text-center text-[13px] text-muted">
                  No matching clips found — try describing it differently.
                </p>
              )}
              {clips.map((clip, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-hairline/60 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold">{clip.title}</h3>
                      <p className="mt-0.5 font-mono text-[12px] text-accent">
                        {clip.label}
                      </p>
                      {clip.reason && (
                        <p className="mt-1.5 text-[13px] text-muted">{clip.reason}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        onClick={() => downloadClip(clip, "mp4")}
                        disabled={downloading === `${clip.start}-mp4`}
                        className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
                      >
                        {downloading === `${clip.start}-mp4` ? "Cutting…" : "Clip MP4"}
                      </button>
                      <button
                        onClick={() => downloadClip(clip, "mp3")}
                        disabled={downloading === `${clip.start}-mp3`}
                        className="rounded-full border border-hairline px-4 py-1.5 text-[13px] font-medium text-muted transition hover:border-accent hover:text-accent disabled:opacity-40"
                      >
                        {downloading === `${clip.start}-mp3` ? "Cutting…" : "MP3"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

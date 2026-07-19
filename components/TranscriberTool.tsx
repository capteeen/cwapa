"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { detectPlatform, PLATFORM_LABELS, type Platform } from "@/lib/platform";
import { formatClock, toSrt } from "@/lib/format";
import type { TranscriptResult } from "@/lib/whisper";
import { TRANSLATION_LANGUAGES } from "@/lib/languages";
import { saveTranscriptProject } from "@/lib/library";

interface ApiResponse {
  platform: Platform | null;
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

export default function TranscriberTool({
  defaultFormat = "best",
  showHistory = true,
}: {
  defaultFormat?: string;
  showHistory?: boolean;
}) {
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dlFormat, setDlFormat] = useState<string>(defaultFormat);
  const [preparing, setPreparing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [translating, setTranslating] = useState(false);
  const [translationCopied, setTranslationCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [momentQuery, setMomentQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [moments, setMoments] = useState<
    | { index: number; reason: string; segment: { start: number; end: number; text: string } }[]
    | null
  >(null);
  const fileInput = useRef<HTMLInputElement>(null);

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
    if (loading) return;
    if (mode === "link" && !url.trim()) return;
    if (mode === "upload" && !file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSummary(null);
    setTranslation(null);
    setSavedProjectId(null);
    setMoments(null);
    setMomentQuery("");
    try {
      let res: Response;
      if (mode === "link") {
        res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
      } else {
        const form = new FormData();
        form.append("file", file!);
        res = await fetch("/api/transcribe-file", { method: "POST", body: form });
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Transcription failed.");
      } else {
        setResult(data);
        if (mode === "link" && data.platform) {
          pushHistory({
            url: url.trim(),
            title: data.meta.title,
            platform: data.platform,
            at: Date.now(),
          });
        }
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

  async function summarize() {
    if (!result || summarizing) return;
    setSummarizing(true);
    setError(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: result.transcript.text }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Summarizing failed.");
      else setSummary(data.summary);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSummarizing(false);
    }
  }

  async function searchMoments(e: React.FormEvent) {
    e.preventDefault();
    if (!result || !momentQuery.trim() || searching) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/search-moments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: momentQuery.trim(),
          segments: result.transcript.segments,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Moment search failed.");
      else setMoments(data.matches);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSearching(false);
    }
  }

  async function saveToLibrary() {
    if (!result || saving || mode !== "link") return;
    setSaving(true);
    setError(null);
    try {
      const id = await saveTranscriptProject({
        title: result.meta.title,
        sourceUrl: result.meta.webpageUrl || url.trim(),
        platform: result.platform,
        durationSeconds: result.meta.durationSeconds,
        thumbnailUrl: result.meta.thumbnail,
        language: result.transcript.language,
        text: result.transcript.text,
        segments: result.transcript.segments,
      });
      setSavedProjectId(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this project.");
    } finally {
      setSaving(false);
    }
  }

  async function translate() {
    if (!result || translating) return;
    setTranslating(true);
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: result.transcript.text,
          targetLanguage,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Translation failed.");
      else setTranslation(data.translation);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setTranslating(false);
    }
  }

  async function copyTranslation() {
    if (!translation) return;
    await navigator.clipboard.writeText(translation);
    setTranslationCopied(true);
    setTimeout(() => setTranslationCopied(false), 1500);
  }

  function downloadTranslation() {
    if (!result || !translation) return;
    const blob = new Blob([translation], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const safeTitle = result.meta.title.replace(/[^\w\d -]+/g, "").slice(0, 50) || "transcript";
    a.download = `${safeTitle}-${targetLanguage}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function momentLink(start: number): string | null {
    if (result?.platform !== "youtube" || !result.meta.webpageUrl) return null;
    const sep = result.meta.webpageUrl.includes("?") ? "&" : "?";
    return `${result.meta.webpageUrl}${sep}t=${Math.max(0, Math.floor(start))}s`;
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
    <div>
      <div className="mb-4 flex justify-center gap-1 rounded-full bg-surface p-1 text-[13px] font-medium sm:mx-auto sm:w-fit">
        {(["link", "upload"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-full px-5 py-1.5 transition sm:flex-none ${
              mode === m ? "bg-white text-ink shadow-sm" : "text-muted"
            }`}
          >
            {m === "link" ? "Paste a link" : "Upload a file"}
          </button>
        ))}
      </div>

      <form onSubmit={transcribe} className="flex flex-col gap-3">
        {mode === "link" ? (
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
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-hairline bg-surface/50 px-5 py-8 text-[15px] text-muted transition hover:border-accent/50"
          >
            {file ? (
              <span className="text-ink">{file.name}</span>
            ) : (
              <>Choose an audio or video file — MP4, MOV, MP3, WAV, M4A…</>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </button>
        )}

        <div className="mt-1 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="submit"
            disabled={loading || (mode === "link" ? !url.trim() : !file)}
            className="w-full rounded-full bg-accent px-8 py-3 text-[15px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto"
          >
            {loading ? "Transcribing…" : "Transcribe"}
          </button>
          {mode === "link" && (
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
          )}
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
                {result.meta.uploader}
                {result.meta.durationSeconds > 0 &&
                  ` · ${formatClock(result.meta.durationSeconds)}`}
                {result.transcript.language && ` · ${result.transcript.language}`}
              </p>
              <p className="mt-1 text-[12px] text-muted/80">
                {result.source === "whisper"
                  ? "Transcribed with Whisper"
                  : "From YouTube captions"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {mode === "link" && (
              savedProjectId ? (
                <a href={`/library/${savedProjectId}`} className="rounded-full bg-emerald-50 px-4 py-2 text-[13px] font-medium text-emerald-700">Saved ✓</a>
              ) : (
                <button onClick={saveToLibrary} disabled={saving} className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white transition hover:bg-black disabled:opacity-40">{saving ? "Saving…" : "Save to library"}</button>
              )
            )}
            <button
              onClick={summarize}
              disabled={summarizing}
              className="rounded-full bg-accent/10 px-4 py-2 text-[13px] font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
            >
              {summarizing ? "Summarizing…" : summary ? "Re-summarize" : "✦ Summarize"}
            </button>
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

          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-hairline/60 p-2 pl-4">
            <span className="text-[13px] font-medium text-muted">Translate to</span>
            <select
              value={targetLanguage}
              onChange={(e) => {
                setTargetLanguage(e.target.value);
                setTranslation(null);
              }}
              className="min-w-32 flex-1 appearance-none bg-transparent px-2 py-2 text-[13px] font-medium outline-none sm:flex-none"
              aria-label="Translation language"
            >
              {TRANSLATION_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={translate}
              disabled={translating}
              className="rounded-full bg-ink px-5 py-2 text-[13px] font-medium text-white transition hover:bg-ink/85 disabled:opacity-40"
            >
              {translating ? "Translating…" : translation ? "Translate again" : "Translate"}
            </button>
          </div>

          {summary && (
            <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-accent/5 p-6 text-[14px] leading-relaxed">
              {summary}
            </div>
          )}

          {translation && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-hairline/60">
              <div className="flex items-center justify-between border-b border-hairline/60 bg-surface/70 px-5 py-3">
                <p className="text-[13px] font-semibold">
                  {TRANSLATION_LANGUAGES.find((language) => language.code === targetLanguage)?.name} translation
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={copyTranslation}
                    className="text-[12px] font-medium text-accent hover:underline"
                  >
                    {translationCopied ? "Copied ✓" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={downloadTranslation}
                    className="text-[12px] font-medium text-accent hover:underline"
                  >
                    Download
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap p-6 text-[15px] leading-relaxed">
                {translation}
              </p>
            </div>
          )}

          {result.transcript.segments.length > 0 && (
            <div className="mt-6">
              <form onSubmit={searchMoments} className="relative">
                <input
                  value={momentQuery}
                  onChange={(e) => setMomentQuery(e.target.value)}
                  placeholder="Search for any moment — “when they talk about pricing”"
                  className="w-full rounded-full bg-surface py-3 pl-5 pr-24 text-[14px] outline-none transition placeholder:text-muted focus:ring-2 focus:ring-accent/40"
                />
                <button
                  type="submit"
                  disabled={searching || !momentQuery.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-accent-hover disabled:opacity-30"
                >
                  {searching ? "…" : "Search"}
                </button>
              </form>

              {moments && (
                <div className="mt-3 space-y-2">
                  {moments.length === 0 && (
                    <p className="py-3 text-center text-[13px] text-muted">
                      No moments matched that search.
                    </p>
                  )}
                  {moments.map((m) => {
                    const link = momentLink(m.segment.start);
                    const stamp = (
                      <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 font-mono text-[12px] font-medium text-accent">
                        {formatClock(m.segment.start)}
                      </span>
                    );
                    return (
                      <div
                        key={m.index}
                        className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3"
                      >
                        {link ? (
                          <a href={link} target="_blank" rel="noreferrer" title="Open the video at this moment">
                            {stamp}
                          </a>
                        ) : (
                          stamp
                        )}
                        <div className="min-w-0">
                          <p className="text-[14px] leading-relaxed">{m.segment.text}</p>
                          {m.reason && (
                            <p className="mt-0.5 text-[12px] text-muted">{m.reason}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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

      {showHistory && !result && !loading && history.length > 0 && (
        <section className="mt-16">
          <h3 className="mb-3 text-center text-[13px] font-medium uppercase tracking-wide text-muted">
            Recent
          </h3>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.url}>
                <button
                  onClick={() => {
                    setMode("link");
                    setUrl(h.url);
                  }}
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
    </div>
  );
}

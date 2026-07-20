"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectPlatform, getYouTubeVideoId, PLATFORM_LABELS } from "@/lib/platform";
import {
  DEFAULT_CAPTION_STYLE,
  type CaptionAspect,
  type CaptionPlacement,
  type CaptionStyle,
  toSrt,
  toVtt,
} from "@/lib/subtitles";
import type { TranscriptSegment } from "@/lib/whisper";
import { formatClock } from "@/lib/format";
import { saveTranscriptProject } from "@/lib/library";
import YouTubePreview, { type YouTubePreviewHandle } from "@/components/YouTubePreview";

interface StudioMeta {
  title: string;
  uploader: string;
  durationSeconds: number;
  thumbnail: string | null;
}

const FONTS: CaptionStyle["font"][] = [
  "Helvetica",
  "Arial",
  "Georgia",
  "Courier New",
  "Impact",
];

const ASPECTS: { value: CaptionAspect; label: string; icon: string }[] = [
  { value: "9:16", label: "Vertical", icon: "▯" },
  { value: "1:1", label: "Square", icon: "□" },
  { value: "16:9", label: "Wide", icon: "▭" },
];

const PLACEMENTS: { value: CaptionPlacement; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

function currentWordIndex(segment: TranscriptSegment, time: number): number {
  const words = segment.text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return -1;
  const progress = Math.min(0.999, Math.max(0, (time - segment.start) / (segment.end - segment.start)));
  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let elapsed = 0;
  for (let index = 0; index < weights.length; index++) {
    elapsed += weights[index] / total;
    if (progress < elapsed) return index;
  }
  return words.length - 1;
}

export default function SubtitleStudio({ defaultUrl = "" }: { defaultUrl?: string }) {
  const [url, setUrl] = useState(defaultUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<StudioMeta | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [style, setStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [currentTime, setCurrentTime] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [renderStage, setRenderStage] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeRef = useRef<YouTubePreviewHandle>(null);
  const segmentRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  const platform = detectPlatform(url);
  const youtubeVideoId = platform === "youtube" ? getYouTubeVideoId(url) : null;
  const duration = meta?.durationSeconds || segments.at(-1)?.end || 1;
  const activeIndex = useMemo(
    () => segments.findIndex((segment) => currentTime >= segment.start && currentTime < segment.end),
    [currentTime, segments]
  );
  const activeSegment = activeIndex >= 0 ? segments[activeIndex] : null;
  const previewUrl = meta && platform !== "youtube"
    ? `/api/studio/source?url=${encodeURIComponent(url.trim())}`
    : undefined;
  const handlePreviewReady = useCallback(() => setPreviewError(false), []);
  const handlePreviewError = useCallback(() => setPreviewError(true), []);

  useEffect(() => {
    if (!rendering) return;
    const interval = window.setInterval(
      () => setRenderStage((stage) => Math.min(stage + 1, 2)),
      7000
    );
    return () => window.clearInterval(interval);
  }, [rendering]);

  async function importVideo(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setMeta(null);
    setSegments([]);
    setCurrentTime(0);
    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not prepare this video.");
      if (!data.transcript?.segments?.length) {
        throw new Error("No timed speech was found in this video.");
      }
      setMeta(data.meta);
      setSegments(data.transcript.segments);
      setPreviewError(false);
      setDirty(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not prepare this video.");
    } finally {
      setLoading(false);
    }
  }

  function updateSegment(index: number, patch: Partial<TranscriptSegment>) {
    setSegments((current) =>
      current.map((segment, segmentIndex) =>
        segmentIndex === index ? { ...segment, ...patch } : segment
      )
    );
    setDirty(true);
  }

  function seek(time: number, focusEditor = false) {
    youtubeRef.current?.seekTo(time);
    const video = videoRef.current;
    if (video) video.currentTime = time;
    setCurrentTime(time);
    if (focusEditor) {
      const index = segments.findIndex((segment) => time >= segment.start && time < segment.end);
      if (index >= 0) {
        segmentRefs.current[index]?.focus();
        segmentRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function downloadText(kind: "srt" | "vtt") {
    const content = kind === "srt" ? toSrt(segments) : toVtt(segments);
    const blob = new Blob([content], { type: kind === "vtt" ? "text/vtt" : "application/x-subrip" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${meta?.title.replace(/[^\w\d -]+/g, "").slice(0, 60) || "captions"}.${kind}`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  async function renderVideo() {
    if (!meta || rendering) return;
    setRendering(true);
    setRenderStage(0);
    setError(null);
    try {
      const response = await fetch("/api/studio/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), segments, style }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not render the captioned video.");
      }
      const blob = await response.blob();
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `${meta.title.replace(/[^\w\d -]+/g, "").slice(0, 50) || "cwapa"}-captioned.mp4`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(anchor.href), 10_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not render the video.");
    } finally {
      setRendering(false);
      setRenderStage(0);
    }
  }

  async function saveToLibrary() {
    if (!meta || saving) return;
    setSaving(true);
    setError(null);
    try {
      const id = await saveTranscriptProject({
        title: meta.title,
        sourceUrl: url.trim(),
        platform: detectPlatform(url),
        durationSeconds: meta.durationSeconds,
        thumbnailUrl: meta.thumbnail,
        language: null,
        text: segments.map((segment) => segment.text).join(" "),
        segments,
      });
      setSavedProjectId(id);
      setDirty(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this project.");
    } finally {
      setSaving(false);
    }
  }

  if (!meta) {
    return (
      <div className="mx-auto max-w-2xl">
        <form onSubmit={importVideo} className="rounded-[28px] border border-hairline/70 bg-white p-3 shadow-[0_30px_90px_-45px_rgba(29,29,31,0.35)]">
          <div className="relative">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste a YouTube, TikTok, or Instagram link"
              spellCheck={false}
              className="w-full rounded-[20px] bg-surface px-5 py-5 pr-28 text-[15px] outline-none transition placeholder:text-muted focus:ring-2 focus:ring-accent/30"
            />
            {platform && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-ink shadow-sm">
                {PLATFORM_LABELS[platform]}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!platform || loading}
            className="mt-3 w-full rounded-full bg-ink px-8 py-3.5 text-[14px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-30"
          >
            {loading ? "Preparing your studio…" : "Create subtitles"}
          </button>
        </form>

        {loading && (
          <div className="mt-10 flex flex-col items-center">
            <div className="studio-orbit" aria-hidden="true"><span /><span /><span /></div>
            <p className="mt-5 text-[14px] font-medium text-ink">Listening for every word</p>
            <p className="mt-1 text-[12px] text-muted">We’re building an editable timeline from the video.</p>
          </div>
        )}
        {error && <p className="mt-6 rounded-2xl bg-red-50 p-4 text-center text-[13px] text-red-600">{error}</p>}
      </div>
    );
  }

  const aspectClass = style.aspect === "9:16" ? "aspect-[9/16] max-h-[620px]" : style.aspect === "1:1" ? "aspect-square" : "aspect-video";
  const placementClass = style.placement === "top" ? "top-[9%]" : style.placement === "middle" ? "top-1/2 -translate-y-1/2" : "bottom-[9%]";
  const previewFontSize = Math.max(18, Math.min(42, style.size * (style.aspect === "9:16" ? 0.55 : 0.42)));
  const activeWord = activeSegment && style.karaoke ? currentWordIndex(activeSegment, currentTime) : -1;

  return (
    <div className="studio-shell overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0b0d] text-white shadow-[0_40px_120px_-45px_rgba(0,0,0,0.8)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{meta.title}</p>
          <p className="mt-0.5 text-[11px] text-white/45">{segments.length} captions · {formatClock(duration)} {dirty ? "· Edited" : "· Synced"}</p>
        </div>
        <div className="flex items-center gap-2">
          {savedProjectId ? <a href={`/library/${savedProjectId}`} className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2 text-[12px] font-medium text-emerald-300">Saved ✓</a> : <button onClick={saveToLibrary} disabled={saving} className="rounded-full border border-white/15 px-3.5 py-2 text-[12px] font-medium text-white/75 transition hover:bg-white/10 disabled:opacity-40">{saving ? "Saving…" : "Save"}</button>}
          <button onClick={() => downloadText("srt")} className="rounded-full border border-white/15 px-3.5 py-2 text-[12px] font-medium text-white/75 transition hover:bg-white/10">SRT</button>
          <button onClick={() => downloadText("vtt")} className="rounded-full border border-white/15 px-3.5 py-2 text-[12px] font-medium text-white/75 transition hover:bg-white/10">VTT</button>
          <button onClick={renderVideo} disabled={rendering} className="rounded-full bg-white px-5 py-2 text-[12px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-50">
            {rendering ? "Rendering…" : "Export video"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="relative flex min-h-[520px] items-center justify-center overflow-hidden bg-[#050506] p-6 lg:p-10">
          <div className={`relative mx-auto w-full overflow-hidden rounded-2xl bg-black shadow-2xl ${aspectClass}`}>
            {youtubeVideoId ? (
              <YouTubePreview
                key={youtubeVideoId}
                ref={youtubeRef}
                videoId={youtubeVideoId}
                onReady={handlePreviewReady}
                onError={handlePreviewError}
                onTimeUpdate={setCurrentTime}
              />
            ) : (
              <video
                key={previewUrl}
                ref={videoRef}
                src={previewUrl}
                poster={meta.thumbnail ?? undefined}
                controls
                playsInline
                preload="metadata"
                onCanPlay={() => setPreviewError(false)}
                onError={() => setPreviewError(true)}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                className="h-full w-full object-cover"
              />
            )}
            {previewError && (
              <div className="absolute inset-x-4 top-4 rounded-xl border border-red-300/20 bg-black/80 px-4 py-3 text-center text-[12px] text-red-100 backdrop-blur">
                This preview could not be played. Try reloading it or use a different source video.
              </div>
            )}
            {activeSegment && (
              <div className={`pointer-events-none absolute left-[7%] right-[7%] text-center ${placementClass}`}>
                <p
                  className="inline rounded-lg bg-black/35 px-2 py-1 font-bold leading-[1.22] [text-shadow:0_2px_5px_rgba(0,0,0,0.9)] box-decoration-clone"
                  style={{ color: style.color, fontFamily: style.font, fontSize: previewFontSize }}
                >
                  {activeSegment.text.trim().split(/\s+/).map((word, index) => (
                    <span key={`${word}-${index}`} className={style.karaoke && index !== activeWord ? "text-white/45" : "text-inherit"}>{word}{" "}</span>
                  ))}
                </p>
              </div>
            )}
          </div>

          {rendering && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 backdrop-blur-xl">
              <div className="text-center">
                <div className="studio-render-mark mx-auto"><span /><span /><span /></div>
                <p className="mt-6 text-[15px] font-semibold">{["Preparing media", "Compositing every frame", "Finishing your video"][renderStage]}</p>
                <p className="mt-1 text-[12px] text-white/45">Keep this tab open. Your download starts automatically.</p>
                <div className="mx-auto mt-5 h-1 w-52 overflow-hidden rounded-full bg-white/10"><span className="studio-render-progress block h-full rounded-full bg-white" /></div>
              </div>
            </div>
          )}
        </section>

        <aside className="border-t border-white/10 bg-[#111114] p-5 lg:border-l lg:border-t-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Canvas</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {ASPECTS.map((aspect) => (
              <button key={aspect.value} onClick={() => setStyle({ ...style, aspect: aspect.value })} className={`rounded-xl border px-2 py-3 text-center transition ${style.aspect === aspect.value ? "border-white bg-white text-black" : "border-white/10 text-white/55 hover:bg-white/5"}`}>
                <span className="block text-lg leading-none">{aspect.icon}</span><span className="mt-1.5 block text-[10px] font-medium">{aspect.label}</span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Typography</p>
          <label className="mt-3 block text-[11px] text-white/45">Font</label>
          <select value={style.font} onChange={(event) => setStyle({ ...style, font: event.target.value as CaptionStyle["font"] })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] outline-none focus:border-white/30">
            {FONTS.map((font) => <option key={font} value={font} className="bg-[#17171a]">{font}</option>)}
          </select>
          <div className="mt-4 grid grid-cols-[1fr_72px] gap-3">
            <label className="text-[11px] text-white/45">Size<input type="range" min="28" max="96" value={style.size} onChange={(event) => setStyle({ ...style, size: Number(event.target.value) })} className="mt-2 w-full accent-white" /></label>
            <label className="text-[11px] text-white/45">Color<span className="mt-1 flex h-9 items-center rounded-xl border border-white/10 bg-white/5 p-1"><input type="color" value={style.color} onChange={(event) => setStyle({ ...style, color: event.target.value })} className="h-full w-full cursor-pointer rounded-lg border-0 bg-transparent" /></span></label>
          </div>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Position</p>
          <div className="mt-3 flex rounded-xl bg-white/5 p-1">
            {PLACEMENTS.map((placement) => <button key={placement.value} onClick={() => setStyle({ ...style, placement: placement.value })} className={`flex-1 rounded-lg py-2 text-[10px] font-medium transition ${style.placement === placement.value ? "bg-white text-black" : "text-white/45"}`}>{placement.label}</button>)}
          </div>
          <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border border-white/10 px-3 py-3 text-[12px] text-white/65"><span>Karaoke highlight</span><input type="checkbox" checked={style.karaoke} onChange={(event) => setStyle({ ...style, karaoke: event.target.checked })} className="h-4 w-4 accent-white" /></label>
        </aside>
      </div>

      <section className="border-t border-white/10 bg-[#0e0e11] px-5 py-5">
        <div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Timeline</p><p className="font-mono text-[11px] text-white/40">{formatClock(currentTime)} / {formatClock(duration)}</p></div>
        <div className="relative mt-3 h-16 overflow-hidden rounded-xl bg-white/[0.035]" onClick={(event) => { const box = event.currentTarget.getBoundingClientRect(); seek(((event.clientX - box.left) / box.width) * duration); }}>
          <div className="absolute inset-y-0 z-10 w-px bg-white" style={{ left: `${Math.min(100, (currentTime / duration) * 100)}%` }}><span className="absolute -left-1 -top-1 h-2 w-2 rotate-45 bg-white" /></div>
          {segments.map((segment, index) => <button key={index} onClick={(event) => { event.stopPropagation(); seek(segment.start, true); }} className={`absolute bottom-2 top-2 overflow-hidden rounded-md border px-2 text-left text-[9px] leading-tight transition ${index === activeIndex ? "border-[#5ac8fa] bg-[#5ac8fa]/25 text-white" : "border-white/10 bg-white/[0.06] text-white/40 hover:bg-white/10"}`} style={{ left: `${(segment.start / duration) * 100}%`, width: `${Math.max(0.6, ((segment.end - segment.start) / duration) * 100)}%` }} title={segment.text}>{segment.text}</button>)}
        </div>
      </section>

      <section className="max-h-[460px] overflow-y-auto border-t border-white/10 bg-[#131316] p-5">
        <div className="mb-3 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Captions</p><p className="text-[11px] text-white/30">Click a timestamp to preview</p></div>
        <div className="space-y-1.5">
          {segments.map((segment, index) => (
            <div key={index} className={`grid grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-xl border p-3 transition ${index === activeIndex ? "border-white/25 bg-white/[0.07]" : "border-transparent hover:bg-white/[0.035]"}`}>
              <div><button onClick={() => seek(segment.start)} className="font-mono text-[11px] text-[#5ac8fa]">{formatClock(segment.start)}</button><div className="mt-2 flex gap-1"><input aria-label="Start time" type="number" min="0" step="0.01" value={segment.start} onChange={(event) => updateSegment(index, { start: Number(event.target.value) })} className="w-11 rounded bg-white/5 px-1 py-1 font-mono text-[9px] text-white/55 outline-none" /><input aria-label="End time" type="number" min="0" step="0.01" value={segment.end} onChange={(event) => updateSegment(index, { end: Number(event.target.value) })} className="w-11 rounded bg-white/5 px-1 py-1 font-mono text-[9px] text-white/55 outline-none" /></div></div>
              <textarea ref={(node) => { segmentRefs.current[index] = node; }} value={segment.text} onChange={(event) => updateSegment(index, { text: event.target.value })} rows={2} className="resize-none bg-transparent text-[13px] leading-relaxed text-white/80 outline-none placeholder:text-white/20" />
            </div>
          ))}
        </div>
      </section>

      {error && <div className="border-t border-red-400/20 bg-red-500/10 px-5 py-3 text-center text-[12px] text-red-200">{error}</div>}
    </div>
  );
}

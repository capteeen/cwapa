"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectPlatform, getYouTubeVideoId, PLATFORM_LABELS } from "@/lib/platform";
import {
  DEFAULT_CAPTION_STYLE,
  wordTimings,
  type CaptionAspect,
  type CaptionPlacement,
  type CaptionStyle,
  type KaraokeMode,
  toSrt,
  toVtt,
} from "@/lib/subtitles";
import { CAPTION_PRESETS, applyPreset } from "@/lib/captionPresets";
import type { TranscriptSegment } from "@/lib/whisper";
import { formatClock } from "@/lib/format";
import { saveTranscriptProject } from "@/lib/library";
import { getInsForgeBrowserClient } from "@/lib/insforge";
import YouTubePreview, { type YouTubePreviewHandle } from "@/components/YouTubePreview";

interface StudioMeta {
  title: string;
  uploader: string;
  durationSeconds: number;
  thumbnail: string | null;
}

const FONTS: CaptionStyle["font"][] = ["Helvetica", "Arial", "Georgia", "Courier New", "Impact"];

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

const KARAOKE_MODES: { value: KaraokeMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "fill", label: "Fill" },
  { value: "pop", label: "Pop" },
  { value: "word", label: "Word" },
];

const MIN_SEGMENT_SECONDS = 0.15;

function activeWordIndex(segment: TranscriptSegment, time: number): number {
  const timings = wordTimings(segment);
  for (let index = 0; index < timings.length; index++) {
    if (time < timings[index].end) return index;
  }
  return timings.length - 1;
}

/** Pick a ruler label interval that keeps labels ~80px apart. */
function labelStep(pxPerSec: number): number {
  for (const step of [1, 2, 5, 10, 15, 30, 60, 120]) {
    if (step * pxPerSec >= 80) return step;
  }
  return 300;
}

type DragState =
  | { type: "scrub" }
  | { type: "move" | "trim-start" | "trim-end"; index: number; originX: number; start: number; end: number };

export default function SubtitleStudio({ defaultUrl = "", projectId = null }: { defaultUrl?: string; projectId?: string | null }) {
  const [url, setUrl] = useState(defaultUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<StudioMeta | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [style, setStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [currentTime, setCurrentTime] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [renderStage, setRenderStage] = useState(0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(projectId);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const [previewError, setPreviewError] = useState(false);
  const [pxPerSec, setPxPerSec] = useState(56);
  const [selected, setSelected] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeRef = useRef<YouTubePreviewHandle>(null);
  const segmentRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const autosaveCount = useRef(0);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [, forceDragPaint] = useState(0);

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

  const watchRender = useCallback(async (jobId: string) => {
    setRendering(true);
    setRenderJobId(jobId);
    window.localStorage.setItem("cwapa:active-render", jobId);
    try {
      for (;;) {
        const response = await fetch(`/api/render-jobs/${jobId}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not resume the render.");
        const job = data.job;
        setRenderProgress(Number(job.progress || 0));
        setRenderStage(job.status === "retrying" ? 1 : job.progress >= 80 ? 2 : job.progress >= 30 ? 1 : 0);
        if (job.status === "succeeded") {
          window.localStorage.removeItem("cwapa:active-render");
          window.location.href = `/api/render-jobs/${jobId}/download`;
          return;
        }
        if (job.status === "failed" || job.status === "cancelled") {
          window.localStorage.removeItem("cwapa:active-render");
          throw new Error(job.error_message || (job.credit_refunded ? "Render failed. Your credit was refunded." : "Render failed."));
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      }
    } finally {
      setRendering(false);
      setRenderJobId(null);
      setRenderProgress(0);
      setRenderStage(0);
    }
  }, []);

  useEffect(() => {
    const activeJob = window.localStorage.getItem("cwapa:active-render");
    if (activeJob) void watchRender(activeJob).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not resume the render."));
  }, [watchRender]);

  useEffect(() => {
    if (!meta || !segments.length) return;
    setAutosaveState("saving");
    const timeout = window.setTimeout(async () => {
      const draft = { url: url.trim(), meta, segments, style, savedAt: new Date().toISOString() };
      window.localStorage.setItem(`cwapa:studio-draft:${url.trim()}`, JSON.stringify(draft));
      if (!savedProjectId) {
        setAutosaveState("offline");
        return;
      }
      try {
        autosaveCount.current += 1;
        const client = getInsForgeBrowserClient();
        const result = await client.database.rpc("save_project_draft", {
          p_project_id: savedProjectId,
          p_segments: segments,
          p_style: style,
          p_reason: "autosave",
          p_create_version: autosaveCount.current % 10 === 0,
        });
        if (result.error) throw result.error;
        setAutosaveState("saved");
      } catch {
        setAutosaveState("offline");
      }
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [meta, savedProjectId, segments, style, url]);

  // Keep the playhead visible while playing.
  useEffect(() => {
    const box = timelineScrollRef.current;
    if (!box || dragRef.current) return;
    const x = currentTime * pxPerSec;
    if (x < box.scrollLeft + 40 || x > box.scrollLeft + box.clientWidth - 80) {
      box.scrollTo({ left: Math.max(0, x - box.clientWidth / 3) });
    }
  }, [currentTime, pxPerSec]);

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
      const cached = window.localStorage.getItem(`cwapa:studio-draft:${url.trim()}`);
      const draft = cached ? JSON.parse(cached) : null;
      setMeta(data.meta);
      setSegments(Array.isArray(draft?.segments) ? draft.segments : data.transcript.segments);
      if (draft?.style) setStyle(draft.style);
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

  function updateStyle(patch: Partial<CaptionStyle>) {
    setStyle((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  function deleteSegment(index: number) {
    setSegments((current) => current.filter((_, i) => i !== index));
    setSelected(null);
    setDirty(true);
  }

  function addSegmentAtPlayhead() {
    const start = Math.max(0, Math.min(duration - 0.5, currentTime));
    const end = Math.min(duration, start + 2);
    setSegments((current) =>
      [...current, { start, end, text: "New caption" }].sort((a, b) => a.start - b.start)
    );
    setDirty(true);
  }

  function seek(time: number, focusEditor = false) {
    const clamped = Math.max(0, Math.min(duration, time));
    youtubeRef.current?.seekTo(clamped);
    const video = videoRef.current;
    if (video) video.currentTime = clamped;
    setCurrentTime(clamped);
    if (focusEditor) {
      const index = segments.findIndex((segment) => clamped >= segment.start && clamped < segment.end);
      if (index >= 0) {
        segmentRefs.current[index]?.focus();
        segmentRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  // ----- CapCut-style timeline drag logic -----
  function timelineX(clientX: number): number {
    const box = timelineScrollRef.current;
    if (!box) return 0;
    const rect = box.getBoundingClientRect();
    return clientX - rect.left + box.scrollLeft;
  }

  function beginScrub(event: React.PointerEvent) {
    event.preventDefault();
    dragRef.current = { type: "scrub" };
    (event.target as Element).setPointerCapture?.(event.pointerId);
    seek(timelineX(event.clientX) / pxPerSec);
  }

  function beginBlockDrag(
    event: React.PointerEvent,
    index: number,
    type: "move" | "trim-start" | "trim-end"
  ) {
    event.preventDefault();
    event.stopPropagation();
    const segment = segments[index];
    dragRef.current = { type, index, originX: event.clientX, start: segment.start, end: segment.end };
    setSelected(index);
    (event.target as Element).setPointerCapture?.(event.pointerId);
    forceDragPaint((n) => n + 1);
  }

  function onTimelinePointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === "scrub") {
      seek(timelineX(event.clientX) / pxPerSec);
      return;
    }
    const dx = (event.clientX - drag.originX) / pxPerSec;
    const length = drag.end - drag.start;
    if (drag.type === "move") {
      const start = Math.max(0, Math.min(duration - length, drag.start + dx));
      updateSegment(drag.index, {
        start: Number(start.toFixed(2)),
        end: Number((start + length).toFixed(2)),
      });
    } else if (drag.type === "trim-start") {
      const start = Math.max(0, Math.min(drag.end - MIN_SEGMENT_SECONDS, drag.start + dx));
      updateSegment(drag.index, { start: Number(start.toFixed(2)) });
    } else {
      const end = Math.min(duration, Math.max(drag.start + MIN_SEGMENT_SECONDS, drag.end + dx));
      updateSegment(drag.index, { end: Number(end.toFixed(2)) });
    }
  }

  function endTimelineDrag() {
    if (dragRef.current && dragRef.current.type !== "scrub") {
      // Keep the caption list in reading order after a move.
      setSegments((current) => [...current].sort((a, b) => a.start - b.start));
    }
    dragRef.current = null;
    forceDragPaint((n) => n + 1);
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
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch("/api/render-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(), segments, style, projectId: savedProjectId,
          title: `${meta.title} — captioned`, idempotencyKey,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not queue the captioned video.");
      await watchRender(data.jobId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not render the video.");
    } finally {
      setRendering(false);
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
  const previewFontSize = Math.max(16, Math.min(46, style.size * (style.aspect === "9:16" ? 0.5 : 0.38)));
  const activeWord = activeSegment && style.karaoke !== "off" ? activeWordIndex(activeSegment, currentTime) : -1;
  const step = labelStep(pxPerSec);
  const timelineWidth = Math.max(320, duration * pxPerSec);
  const dragging = dragRef.current !== null && dragRef.current.type !== "scrub";

  const previewTextStyle: React.CSSProperties = {
    fontFamily: style.font === "Impact" ? "Impact, 'Arial Black', sans-serif" : style.font,
    fontSize: previewFontSize,
    fontWeight: style.bold ? 800 : 500,
    color: style.color,
    textTransform: style.uppercase ? "uppercase" : "none",
    WebkitTextStroke: style.outline > 0 && !style.box ? `${Math.min(3, style.outline * 0.45)}px ${style.outlineColor}` : undefined,
    textShadow: style.glow
      ? `0 0 14px ${style.highlightColor}, 0 0 30px ${style.highlightColor}`
      : style.shadow > 0
        ? `0 ${style.shadow}px ${style.shadow * 2.5}px rgba(0,0,0,.85)`
        : undefined,
    background: style.box ? style.boxColor : "rgba(0,0,0,.3)",
    lineHeight: 1.2,
  };

  function renderPreviewCaption() {
    if (!activeSegment) return null;
    const words = activeSegment.text.trim().split(/\s+/).filter(Boolean);
    if (style.karaoke === "word") {
      const word = words[Math.max(0, activeWord)] ?? "";
      return <span>{word}</span>;
    }
    return words.map((word, index) => {
      let color = style.color;
      if (style.karaoke === "fill" || style.karaoke === "pop") {
        color = index <= activeWord ? style.highlightColor : style.color;
      }
      return (
        <span key={`${word}-${index}`} style={{ color }}>
          {word}{" "}
        </span>
      );
    });
  }

  return (
    <div className="studio-shell overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0b0d] text-white shadow-[0_40px_120px_-45px_rgba(0,0,0,0.8)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{meta.title}</p>
          <p className="mt-0.5 text-[11px] text-white/45">{segments.length} captions · {formatClock(duration)} {dirty ? "· Edited" : "· Synced"}</p>
        </div>
        <div className="flex items-center gap-2">
          {savedProjectId ? <a href={`/library/${savedProjectId}`} className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2 text-[12px] font-medium text-emerald-300">{autosaveState === "saving" ? "Saving…" : autosaveState === "offline" ? "Saved locally" : "Saved ✓"}</a> : <button onClick={saveToLibrary} disabled={saving} className="rounded-full border border-white/15 px-3.5 py-2 text-[12px] font-medium text-white/75 transition hover:bg-white/10 disabled:opacity-40">{saving ? "Saving…" : "Save"}</button>}
          <button onClick={() => downloadText("srt")} className="rounded-full border border-white/15 px-3.5 py-2 text-[12px] font-medium text-white/75 transition hover:bg-white/10">SRT</button>
          <button onClick={() => downloadText("vtt")} className="rounded-full border border-white/15 px-3.5 py-2 text-[12px] font-medium text-white/75 transition hover:bg-white/10">VTT</button>
          <button onClick={renderVideo} disabled={rendering} className="rounded-full bg-white px-5 py-2 text-[12px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-50">
            {rendering ? `${renderProgress || 1}% · Rendering` : "Export video"}
          </button>
        </div>
      </div>

      {/* Trending style presets */}
      <div className="border-b border-white/10 bg-[#0e0e11] px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Caption styles</p>
          <p className="text-[10px] text-white/25">Trending looks — tweak anything after picking one</p>
        </div>
        <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
          {CAPTION_PRESETS.map((preset) => {
            const ps = preset.style;
            const active = style.preset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setStyle(applyPreset(style, preset))}
                className={`group w-[118px] shrink-0 rounded-2xl border p-2 text-left transition ${active ? "border-[#5ac8fa] bg-[#5ac8fa]/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}
              >
                <span
                  className="flex h-12 items-center justify-center overflow-hidden rounded-xl bg-[#1c1c20] px-1"
                  style={{
                    fontFamily: ps.font === "Impact" ? "Impact, 'Arial Black', sans-serif" : ps.font,
                    fontWeight: ps.bold ? 800 : 500,
                    textTransform: ps.uppercase ? "uppercase" : "none",
                    fontSize: 13,
                    color: ps.color,
                    WebkitTextStroke: ps.outline > 0 && !ps.box ? `0.6px ${ps.outlineColor}` : undefined,
                    textShadow: ps.glow ? `0 0 10px ${ps.highlightColor}` : undefined,
                  }}
                >
                  <span style={ps.box ? { background: ps.boxColor, borderRadius: 6, padding: "2px 6px" } : undefined}>
                    {ps.karaoke === "word" ? (
                      "WORD"
                    ) : (
                      <>
                        Every <span style={{ color: ps.highlightColor }}>word</span>
                      </>
                    )}
                  </span>
                </span>
                <span className={`mt-1.5 block text-[11px] font-semibold ${active ? "text-[#8edfff]" : "text-white/80"}`}>{preset.name}</span>
                <span className="block text-[9px] text-white/35">{preset.tag}</span>
              </button>
            );
          })}
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
                <p className="inline rounded-lg px-2 py-1 box-decoration-clone" style={previewTextStyle}>
                  {renderPreviewCaption()}
                </p>
              </div>
            )}
          </div>

          {rendering && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 backdrop-blur-xl">
              <div className="text-center">
                <div className="studio-render-mark mx-auto"><span /><span /><span /></div>
                <p className="mt-6 text-[15px] font-semibold">{["Preparing media", "Compositing every frame", "Finishing your video"][renderStage]}</p>
                <p className="mt-2 text-[11px] text-white/40">{renderJobId ? "Safe to leave—this render will continue in the background." : "Your render is being secured."}</p>
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
              <button key={aspect.value} onClick={() => updateStyle({ aspect: aspect.value })} className={`rounded-xl border px-2 py-3 text-center transition ${style.aspect === aspect.value ? "border-white bg-white text-black" : "border-white/10 text-white/55 hover:bg-white/5"}`}>
                <span className="block text-lg leading-none">{aspect.icon}</span><span className="mt-1.5 block text-[10px] font-medium">{aspect.label}</span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Typography</p>
          <label className="mt-3 block text-[11px] text-white/45">Font</label>
          <select value={style.font} onChange={(event) => updateStyle({ font: event.target.value as CaptionStyle["font"] })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] outline-none focus:border-white/30">
            {FONTS.map((font) => <option key={font} value={font} className="bg-[#17171a]">{font}</option>)}
          </select>
          <label className="mt-4 block text-[11px] text-white/45">Size<input type="range" min="28" max="110" value={style.size} onChange={(event) => updateStyle({ size: Number(event.target.value) })} className="mt-2 w-full accent-white" /></label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-[11px] text-white/45">Text<span className="mt-1 flex h-9 items-center rounded-xl border border-white/10 bg-white/5 p-1"><input type="color" value={style.color} onChange={(event) => updateStyle({ color: event.target.value })} className="h-full w-full cursor-pointer rounded-lg border-0 bg-transparent" /></span></label>
            <label className="text-[11px] text-white/45">Highlight<span className="mt-1 flex h-9 items-center rounded-xl border border-white/10 bg-white/5 p-1"><input type="color" value={style.highlightColor} onChange={(event) => updateStyle({ highlightColor: event.target.value })} className="h-full w-full cursor-pointer rounded-lg border-0 bg-transparent" /></span></label>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => updateStyle({ uppercase: !style.uppercase })} className={`flex-1 rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${style.uppercase ? "border-white bg-white text-black" : "border-white/10 text-white/55 hover:bg-white/5"}`}>AA</button>
            <button onClick={() => updateStyle({ bold: !style.bold })} className={`flex-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition ${style.bold ? "border-white bg-white text-black" : "border-white/10 text-white/55 hover:bg-white/5"}`}>B</button>
            <button onClick={() => updateStyle({ glow: !style.glow })} className={`flex-1 rounded-xl border px-2 py-2 text-[11px] transition ${style.glow ? "border-white bg-white text-black" : "border-white/10 text-white/55 hover:bg-white/5"}`}>✦</button>
            <button onClick={() => updateStyle({ box: !style.box })} className={`flex-1 rounded-xl border px-2 py-2 text-[11px] transition ${style.box ? "border-white bg-white text-black" : "border-white/10 text-white/55 hover:bg-white/5"}`}>▣</button>
          </div>
          <label className="mt-3 block text-[11px] text-white/45">Outline<input type="range" min="0" max="8" value={style.outline} onChange={(event) => updateStyle({ outline: Number(event.target.value) })} className="mt-2 w-full accent-white" /></label>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Animation</p>
          <div className="mt-3 flex rounded-xl bg-white/5 p-1">
            {KARAOKE_MODES.map((mode) => <button key={mode.value} onClick={() => updateStyle({ karaoke: mode.value })} className={`flex-1 rounded-lg py-2 text-[10px] font-medium transition ${style.karaoke === mode.value ? "bg-white text-black" : "text-white/45"}`}>{mode.label}</button>)}
          </div>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Position</p>
          <div className="mt-3 flex rounded-xl bg-white/5 p-1">
            {PLACEMENTS.map((placement) => <button key={placement.value} onClick={() => updateStyle({ placement: placement.value })} className={`flex-1 rounded-lg py-2 text-[10px] font-medium transition ${style.placement === placement.value ? "bg-white text-black" : "text-white/45"}`}>{placement.label}</button>)}
          </div>
        </aside>
      </div>

      {/* CapCut-style timeline */}
      <section className="border-t border-white/10 bg-[#0e0e11] px-5 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Timeline</p>
            <button onClick={addSegmentAtPlayhead} className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-medium text-white/60 transition hover:bg-white/10">＋ Caption at playhead</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPxPerSec((v) => Math.max(14, v / 1.4))} className="grid h-6 w-6 place-items-center rounded-md border border-white/15 text-[12px] text-white/60 transition hover:bg-white/10">−</button>
            <button onClick={() => setPxPerSec((v) => Math.min(240, v * 1.4))} className="grid h-6 w-6 place-items-center rounded-md border border-white/15 text-[12px] text-white/60 transition hover:bg-white/10">＋</button>
            <button onClick={() => { const box = timelineScrollRef.current; if (box) setPxPerSec(Math.max(14, (box.clientWidth - 24) / duration)); }} className="rounded-md border border-white/15 px-2 py-0.5 text-[10px] text-white/60 transition hover:bg-white/10">Fit</button>
            <p className="ml-2 font-mono text-[11px] text-white/40">{formatClock(currentTime)} / {formatClock(duration)}</p>
          </div>
        </div>

        <div
          ref={timelineScrollRef}
          className={`relative mt-3 overflow-x-auto overscroll-x-contain rounded-xl bg-white/[0.03] ${dragging ? "select-none" : ""}`}
          onPointerMove={onTimelinePointerMove}
          onPointerUp={endTimelineDrag}
          onPointerLeave={() => { if (dragRef.current?.type === "scrub") dragRef.current = null; }}
        >
          <div className="relative" style={{ width: timelineWidth }}>
            {/* Ruler */}
            <div className="relative h-7 cursor-col-resize border-b border-white/10" onPointerDown={beginScrub}>
              {Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step).map((t) => (
                <div key={t} className="absolute bottom-0 top-0" style={{ left: t * pxPerSec }}>
                  <span className="absolute bottom-0 h-2 w-px bg-white/25" />
                  <span className="absolute left-1.5 top-1 font-mono text-[9px] text-white/35">{formatClock(t)}</span>
                </div>
              ))}
              {step >= 2 &&
                Array.from({ length: Math.floor(duration) + 1 }, (_, i) => i).filter((t) => t % step !== 0).map((t) => (
                  <span key={`m${t}`} className="absolute bottom-0 h-1 w-px bg-white/10" style={{ left: t * pxPerSec }} />
                ))}
            </div>

            {/* Caption track */}
            <div className="relative h-[74px]" onPointerDown={beginScrub}>
              {segments.map((segment, index) => {
                const isActive = index === activeIndex;
                const isSelected = index === selected;
                return (
                  <div
                    key={index}
                    onPointerDown={(event) => beginBlockDrag(event, index, "move")}
                    onDoubleClick={() => seek(segment.start, true)}
                    className={`absolute bottom-2.5 top-2.5 cursor-grab touch-none overflow-hidden rounded-lg border text-left transition-colors active:cursor-grabbing ${
                      isSelected
                        ? "z-10 border-[#5ac8fa] bg-[#5ac8fa]/30"
                        : isActive
                          ? "border-[#5ac8fa]/60 bg-[#5ac8fa]/20"
                          : "border-white/10 bg-white/[0.07] hover:bg-white/10"
                    }`}
                    style={{ left: segment.start * pxPerSec, width: Math.max(10, (segment.end - segment.start) * pxPerSec) }}
                    title={segment.text}
                  >
                    <span className="pointer-events-none block truncate px-2.5 pt-1.5 text-[10px] font-medium leading-tight text-white/85">{segment.text}</span>
                    <span className="pointer-events-none absolute bottom-1 left-2.5 font-mono text-[8px] text-white/40">{formatClock(segment.start)}</span>
                    {/* Trim handles */}
                    <span onPointerDown={(event) => beginBlockDrag(event, index, "trim-start")} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize touch-none bg-gradient-to-r from-white/25 to-transparent opacity-0 transition hover:opacity-100" style={{ opacity: isSelected ? 1 : undefined }} />
                    <span onPointerDown={(event) => beginBlockDrag(event, index, "trim-end")} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize touch-none bg-gradient-to-l from-white/25 to-transparent opacity-0 transition hover:opacity-100" style={{ opacity: isSelected ? 1 : undefined }} />
                  </div>
                );
              })}

              {/* Playhead */}
              <div className="pointer-events-none absolute -top-7 bottom-0 z-20 w-px bg-[#ff453a]" style={{ left: currentTime * pxPerSec }}>
                <span className="absolute -left-[5px] -top-px h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-[#ff453a]" />
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-white/25">Drag a block to move it · drag its edges to retime · double-click to jump to its text</p>
      </section>

      <section className="max-h-[460px] overflow-y-auto border-t border-white/10 bg-[#131316] p-5">
        <div className="mb-3 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Captions</p><p className="text-[11px] text-white/30">Click a timestamp to preview</p></div>
        <div className="space-y-1.5">
          {segments.map((segment, index) => (
            <div key={index} className={`grid grid-cols-[92px_minmax(0,1fr)_26px] gap-3 rounded-xl border p-3 transition ${index === activeIndex ? "border-white/25 bg-white/[0.07]" : "border-transparent hover:bg-white/[0.035]"}`}>
              <div><button onClick={() => seek(segment.start)} className="font-mono text-[11px] text-[#5ac8fa]">{formatClock(segment.start)}</button><div className="mt-2 flex gap-1"><input aria-label="Start time" type="number" min="0" step="0.01" value={segment.start} onChange={(event) => updateSegment(index, { start: Number(event.target.value) })} className="w-11 rounded bg-white/5 px-1 py-1 font-mono text-[9px] text-white/55 outline-none" /><input aria-label="End time" type="number" min="0" step="0.01" value={segment.end} onChange={(event) => updateSegment(index, { end: Number(event.target.value) })} className="w-11 rounded bg-white/5 px-1 py-1 font-mono text-[9px] text-white/55 outline-none" /></div></div>
              <textarea ref={(node) => { segmentRefs.current[index] = node; }} value={segment.text} onChange={(event) => updateSegment(index, { text: event.target.value })} rows={2} className="resize-none bg-transparent text-[13px] leading-relaxed text-white/80 outline-none placeholder:text-white/20" />
              <button onClick={() => deleteSegment(index)} aria-label="Delete caption" className="self-start rounded-md p-1 text-white/25 transition hover:bg-white/10 hover:text-red-300">✕</button>
            </div>
          ))}
        </div>
      </section>

      {error && <div className="border-t border-red-400/20 bg-red-500/10 px-5 py-3 text-center text-[12px] text-red-200">{error}</div>}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatClock, toSrt, toVtt } from "@/lib/format";
import { getInsForgeBrowserClient, type ProjectRecord, type TranscriptRecord, type TranscriptSegmentRecord } from "@/lib/insforge";

export default function ProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [transcript, setTranscript] = useState<TranscriptRecord | null>(null);
  const [segments, setSegments] = useState<TranscriptSegmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const client = getInsForgeBrowserClient();
        const [projectResult, transcriptResult, segmentResult] = await Promise.all([
          client.database.from("projects").select("*").eq("id", projectId).maybeSingle(),
          client.database.from("transcripts").select("*").eq("project_id", projectId).maybeSingle(),
          client.database.from("transcript_segments").select("*").eq("project_id", projectId).order("position"),
        ]);
        if (projectResult.error) throw projectResult.error;
        if (transcriptResult.error) throw transcriptResult.error;
        if (segmentResult.error) throw segmentResult.error;
        setProject(projectResult.data as ProjectRecord | null);
        setTranscript(transcriptResult.data as TranscriptRecord | null);
        setSegments((segmentResult.data ?? []) as TranscriptSegmentRecord[]);
      } catch (reason: any) { setError(reason?.message ?? "Could not open this project."); }
      finally { setLoading(false); }
    }
    void load();
  }, [projectId]);

  async function saveTitle() {
    if (!project) return;
    const client = getInsForgeBrowserClient();
    const { error: updateError } = await client.database.from("projects").update({ title: project.title.trim() }).eq("id", project.id);
    if (updateError) setError(updateError.message);
    else setEditingTitle(false);
  }

  function download(kind: "srt" | "vtt") {
    if (!project) return;
    const normalized = segments.map((segment) => ({ start: Number(segment.start_seconds), end: Number(segment.end_seconds), text: segment.text }));
    const blob = new Blob([kind === "srt" ? toSrt(normalized) : toVtt(normalized)], { type: "text/plain" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob); anchor.download = `${project.title}.${kind}`; anchor.click(); URL.revokeObjectURL(anchor.href);
  }

  if (loading) return <div className="mx-auto mt-20 h-64 max-w-3xl animate-pulse rounded-3xl bg-surface" />;
  if (error || !project) return <div className="mx-auto mt-20 max-w-xl rounded-3xl bg-red-50 p-8 text-center text-[14px] text-red-600">{error ?? "Project not found."}</div>;

  return <div className="mx-auto max-w-4xl"><Link href="/library" className="text-[12px] font-medium text-muted hover:text-ink">← Library</Link><div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1">{editingTitle ? <div className="flex gap-2"><input value={project.title} onChange={(event) => setProject({ ...project, title: event.target.value })} className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2 text-xl font-semibold outline-none" /><button onClick={saveTitle} className="rounded-full bg-ink px-4 text-[12px] text-white">Save</button></div> : <button onClick={() => setEditingTitle(true)} className="max-w-full text-left text-3xl font-semibold tracking-tight hover:text-accent">{project.title}</button>}<p className="mt-2 text-[12px] capitalize text-muted">{project.platform ?? "upload"} · {project.duration_seconds ? formatClock(project.duration_seconds) : "Unknown length"} · {project.language ?? "Auto language"}</p></div><div className="flex gap-2"><button onClick={() => download("srt")} className="rounded-full border border-hairline px-4 py-2 text-[12px]">SRT</button><button onClick={() => download("vtt")} className="rounded-full border border-hairline px-4 py-2 text-[12px]">VTT</button>{project.source_url && <Link href={`/studio?url=${encodeURIComponent(project.source_url)}`} className="rounded-full bg-accent px-4 py-2 text-[12px] font-semibold text-white">Open Studio</Link>}</div></div>{transcript && <div className="mt-8 max-h-[36rem] overflow-y-auto rounded-3xl border border-hairline/60 p-6 sm:p-8">{segments.length ? <div className="space-y-4">{segments.map((segment) => <p key={segment.id} className="text-[15px] leading-relaxed"><span className="mr-3 font-mono text-[11px] text-accent/70">{formatClock(Number(segment.start_seconds))}</span>{segment.text}</p>)}</div> : <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{transcript.full_text}</p>}</div>}</div>;
}

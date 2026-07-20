"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatClock, toSrt, toVtt } from "@/lib/format";
import {
  getInsForgeBrowserClient,
  type ProjectRecord,
  type ProjectVersionRecord,
  type TranscriptRecord,
  type TranscriptSegmentRecord,
} from "@/lib/insforge";

export default function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [transcript, setTranscript] = useState<TranscriptRecord | null>(null);
  const [segments, setSegments] = useState<TranscriptSegmentRecord[]>([]);
  const [versions, setVersions] = useState<ProjectVersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  async function load() {
    try {
      const client = getInsForgeBrowserClient();
      const [projectResult, transcriptResult, segmentResult, versionsResult] = await Promise.all([
        client.database.from("projects").select("*").eq("id", projectId).maybeSingle(),
        client.database.from("transcripts").select("*").eq("project_id", projectId).maybeSingle(),
        client.database.from("transcript_segments").select("*").eq("project_id", projectId).order("position"),
        client.database.from("project_versions").select("id,project_id,version_number,source_revision,reason,created_at").eq("project_id", projectId).order("version_number", { ascending: false }).limit(20),
      ]);
      if (projectResult.error) throw projectResult.error;
      if (transcriptResult.error) throw transcriptResult.error;
      if (segmentResult.error) throw segmentResult.error;
      if (versionsResult.error) throw versionsResult.error;
      setProject(projectResult.data as ProjectRecord | null);
      setTranscript(transcriptResult.data as TranscriptRecord | null);
      setSegments((segmentResult.data ?? []) as TranscriptSegmentRecord[]);
      setVersions((versionsResult.data ?? []) as ProjectVersionRecord[]);
    } catch (reason: any) {
      setError(reason?.message ?? "Could not open this project.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [projectId]);

  async function saveTitle() {
    if (!project) return;
    const client = getInsForgeBrowserClient();
    const result = await client.database.from("projects").update({ title: project.title.trim() }).eq("id", project.id);
    if (result.error) setError(result.error.message);
    else setEditingTitle(false);
  }

  async function restoreVersion(versionId: string) {
    setRestoring(versionId);
    setError(null);
    try {
      const result = await getInsForgeBrowserClient().database.rpc("restore_project_version", { p_version_id: versionId });
      if (result.error) throw result.error;
      await load();
    } catch (reason: any) {
      setError(reason?.message ?? "Could not restore that version.");
    } finally {
      setRestoring(null);
    }
  }

  function download(kind: "srt" | "vtt") {
    if (!project) return;
    const normalized = segments.map((segment) => ({ start: Number(segment.start_seconds), end: Number(segment.end_seconds), text: segment.text }));
    const blob = new Blob([kind === "srt" ? toSrt(normalized) : toVtt(normalized)], { type: "text/plain" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${project.title}.${kind}`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  function repurpose() {
    if (!transcript) return;
    window.sessionStorage.setItem("cwapa:repurpose-transcript", transcript.full_text);
    router.push("/repurpose");
  }

  if (loading) return <div className="mx-auto mt-20 h-64 max-w-3xl animate-pulse rounded-3xl bg-surface" />;
  if (error && !project) return <div className="mx-auto mt-20 max-w-xl rounded-3xl bg-red-50 p-8 text-center text-[14px] text-red-600">{error}</div>;
  if (!project) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/library" className="text-[12px] font-medium text-muted hover:text-ink">← Library</Link>
      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {editingTitle ? <div className="flex gap-2"><input value={project.title} onChange={(event) => setProject({ ...project, title: event.target.value })} className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2 text-xl font-semibold outline-none" /><button onClick={saveTitle} className="rounded-full bg-ink px-4 text-[12px] text-white">Save</button></div> : <button onClick={() => setEditingTitle(true)} className="max-w-full text-left text-3xl font-semibold tracking-tight hover:text-accent">{project.title}</button>}
          <p className="mt-2 text-[12px] capitalize text-muted">{project.platform ?? "upload"} · {project.duration_seconds ? formatClock(project.duration_seconds) : "Unknown length"} · {project.language ?? "Auto language"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => download("srt")} className="rounded-full border border-hairline px-4 py-2 text-[12px]">SRT</button>
          <button onClick={() => download("vtt")} className="rounded-full border border-hairline px-4 py-2 text-[12px]">VTT</button>
          {transcript && <button onClick={repurpose} className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white">Repurpose</button>}
          {project.source_url && <Link href={`/studio?url=${encodeURIComponent(project.source_url)}&project=${project.id}`} className="rounded-full bg-accent px-4 py-2 text-[12px] font-semibold text-white">Open Studio</Link>}
        </div>
      </div>
      {error && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-[12px] text-red-600">{error}</p>}
      {transcript && <div className="mt-8 max-h-[36rem] overflow-y-auto rounded-3xl border border-hairline/60 p-6 sm:p-8">{segments.length ? <div className="space-y-4">{segments.map((segment) => <p key={segment.id} className="text-[15px] leading-relaxed"><span className="mr-3 font-mono text-[11px] text-accent/70">{formatClock(Number(segment.start_seconds))}</span>{segment.text}</p>)}</div> : <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{transcript.full_text}</p>}</div>}

      <section className="mt-8 rounded-3xl border border-hairline/60 bg-surface/60 p-6">
        <div className="flex items-center justify-between"><div><h2 className="text-[15px] font-semibold">Version history</h2><p className="mt-1 text-[11px] text-muted">Periodic snapshots protect your subtitle edits.</p></div><span className="rounded-full bg-white px-3 py-1 text-[10px] text-muted">{versions.length} saved</span></div>
        {versions.length === 0 ? <p className="mt-6 text-[12px] text-muted">Versions appear automatically as you edit a saved project.</p> : <div className="mt-5 divide-y divide-hairline/60">{versions.map((version) => <div key={version.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-[12px] font-medium">Version {version.version_number}</p><p className="mt-1 text-[10px] capitalize text-muted">{version.reason.replace("_", " ")} · {new Date(version.created_at).toLocaleString()}</p></div><button onClick={() => restoreVersion(version.id)} disabled={Boolean(restoring)} className="rounded-full border border-hairline bg-white px-4 py-2 text-[10px] font-semibold disabled:opacity-40">{restoring === version.id ? "Restoring…" : "Restore"}</button></div>)}</div>}
      </section>
    </div>
  );
}

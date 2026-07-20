"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getInsForgeBrowserClient, type FolderRecord, type ProjectRecord } from "@/lib/insforge";
import { signOutAction } from "@/app/auth/actions";

export default function LibraryClient() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | "all" | "unfiled">("all");
  const [query, setQuery] = useState("");
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const client = getInsForgeBrowserClient();
      const [projectsResult, foldersResult] = await Promise.all([
        client.database.from("projects").select("id,user_id,folder_id,title,source_url,platform,status,duration_seconds,thumbnail_url,language,created_at,updated_at").order("updated_at", { ascending: false }),
        client.database.from("folders").select("id,user_id,name,created_at,updated_at").order("name"),
      ]);
      if (projectsResult.error) throw projectsResult.error;
      if (foldersResult.error) throw foldersResult.error;
      setProjects((projectsResult.data ?? []) as ProjectRecord[]);
      setFolders((foldersResult.data ?? []) as FolderRecord[]);
    } catch (reason: any) {
      setError(reason?.message ?? "Could not load your library.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return projects.filter((project) => {
      const folderMatch = selectedFolder === "all" || (selectedFolder === "unfiled" ? !project.folder_id : project.folder_id === selectedFolder);
      const queryMatch = !normalized || project.title.toLowerCase().includes(normalized) || project.platform?.toLowerCase().includes(normalized);
      return folderMatch && queryMatch;
    });
  }, [projects, query, selectedFolder]);

  async function createFolder(event: React.FormEvent) {
    event.preventDefault();
    if (!folderName.trim()) return;
    try {
      const client = getInsForgeBrowserClient();
      const { error: insertError } = await client.database.from("folders").insert([{ name: folderName.trim() }]);
      if (insertError) throw insertError;
      setFolderName("");
      await load();
    } catch (reason: any) {
      setError(reason?.message ?? "Could not create the folder.");
    }
  }

  async function deleteProject(id: string) {
    try {
      const client = getInsForgeBrowserClient();
      const { error: deleteError } = await client.database.from("projects").delete().eq("id", id);
      if (deleteError) throw deleteError;
      setProjects((current) => current.filter((project) => project.id !== id));
    } catch (reason: any) {
      setError(reason?.message ?? "Could not delete this project.");
    }
  }

  async function moveProject(id: string, folderId: string) {
    try {
      const client = getInsForgeBrowserClient();
      const { error: updateError } = await client.database.from("projects").update({ folder_id: folderId || null }).eq("id", id);
      if (updateError) throw updateError;
      setProjects((current) => current.map((project) => project.id === id ? { ...project, folder_id: folderId || null } : project));
    } catch (reason: any) {
      setError(reason?.message ?? "Could not move this project.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-3xl bg-surface p-4 lg:sticky lg:top-24 lg:h-fit">
        <div className="space-y-1 text-[13px]">
          <button onClick={() => setSelectedFolder("all")} className={`w-full rounded-xl px-3 py-2.5 text-left ${selectedFolder === "all" ? "bg-white font-semibold shadow-sm" : "text-muted"}`}>All projects <span className="float-right text-[11px]">{projects.length}</span></button>
          <button onClick={() => setSelectedFolder("unfiled")} className={`w-full rounded-xl px-3 py-2.5 text-left ${selectedFolder === "unfiled" ? "bg-white font-semibold shadow-sm" : "text-muted"}`}>Unfiled</button>
          {folders.map((folder) => <button key={folder.id} onClick={() => setSelectedFolder(folder.id)} className={`w-full truncate rounded-xl px-3 py-2.5 text-left ${selectedFolder === folder.id ? "bg-white font-semibold shadow-sm" : "text-muted"}`}>{folder.name}</button>)}
        </div>
        <form onSubmit={createFolder} className="mt-4 border-t border-hairline/60 pt-4"><input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="New folder" className="w-full rounded-xl bg-white px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-accent/25" /><button className="mt-2 w-full rounded-xl border border-hairline bg-white py-2 text-[11px] font-medium text-muted hover:text-ink">Add folder</button></form>
      </aside>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-3xl font-semibold tracking-tight">Your library</h1><p className="mt-1 text-[13px] text-muted">Every transcript, ready when you are.</p></div>
          <div className="flex gap-2"><Link href="/activity" className="rounded-full border border-hairline px-4 py-2.5 text-[12px] font-medium text-muted">Usage & renders</Link><Link href="/" className="rounded-full bg-ink px-5 py-2.5 text-[12px] font-semibold text-white">New transcript</Link><button onClick={async () => { await signOutAction(); window.location.href = "/"; }} className="rounded-full border border-hairline px-4 py-2.5 text-[12px] text-muted">Sign out</button></div>
        </div>
        <div className="mt-7 relative"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles or platforms" className="w-full rounded-2xl bg-surface px-5 py-3.5 text-[14px] outline-none focus:ring-2 focus:ring-accent/25" /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">⌕</span></div>
        {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-[12px] text-red-600">{error}</p>}
        {loading ? <div className="mt-12 grid gap-3 sm:grid-cols-2">{[0,1,2,3].map((item) => <div key={item} className="h-40 animate-pulse rounded-3xl bg-surface" />)}</div> : visibleProjects.length === 0 ? <div className="mt-12 rounded-3xl border border-dashed border-hairline p-12 text-center"><p className="text-[15px] font-semibold">Nothing here yet</p><p className="mt-2 text-[13px] text-muted">Save a transcript and it will appear here.</p><Link href="/" className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-[12px] font-semibold text-white">Create your first project</Link></div> : <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visibleProjects.map((project) => <article key={project.id} className="group overflow-hidden rounded-3xl border border-hairline/60 bg-white transition hover:-translate-y-0.5 hover:shadow-xl"><Link href={`/library/${project.id}`} className="block">{project.thumbnail_url ? <img src={project.thumbnail_url} alt="" className="h-32 w-full object-cover" /> : <div className="flex h-32 items-center justify-center bg-[linear-gradient(135deg,#f5f5f7,#e8f3ff)] text-2xl">◫</div>}<div className="p-5"><p className="truncate text-[14px] font-semibold">{project.title}</p><p className="mt-1 text-[11px] capitalize text-muted">{project.platform ?? "upload"} · {new Date(project.updated_at).toLocaleDateString()}</p></div></Link><div className="flex items-center gap-2 border-t border-hairline/50 px-4 py-3"><select value={project.folder_id ?? ""} onChange={(event) => moveProject(project.id, event.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] text-muted outline-none"><option value="">Unfiled</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><button onClick={() => deleteProject(project.id)} className="text-[11px] text-muted hover:text-red-600">Delete</button></div></article>)}</div>}
      </section>
    </div>
  );
}

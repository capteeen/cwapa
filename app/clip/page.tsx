import type { Metadata } from "next";
import ClipFinder from "@/components/ClipFinder";

export const metadata: Metadata = {
  title: "Clip Finder — find clips with unexpected precision | cwapa",
  description:
    "Describe the clip you want in plain English and cwapa finds the exact moment and cuts it for you. Built for creators and clippers.",
};

export default function ClipPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 pb-24 pt-20">
      <header className="mb-12 text-center">
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-accent">
          For clippers
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-[44px] sm:leading-tight">
          Find clips with unexpected precision.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-muted">
          Paste a video, describe the moment you want in plain English, and cwapa
          finds it and cuts the clip for you. No scrubbing. No guessing.
        </p>
      </header>

      <ClipFinder />

      <section className="mt-16 grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Dialogue",
            body: "Search every spoken word and jump to the exact moment it was said.",
          },
          {
            title: "Topics & moments",
            body: 'Find moments like "the main argument" or "the funniest bit".',
          },
          {
            title: "Cut & download",
            body: "Download each clip as an MP4 or MP3, trimmed to the exact range.",
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
    </main>
  );
}

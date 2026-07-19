import Link from "next/link";
import TranscriberTool from "@/components/TranscriberTool";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 pb-24 pt-20">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-[44px] sm:leading-tight">
          Turn any video into text.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-muted">
          Paste a TikTok, YouTube, or Instagram link — or upload a file. Get a
          clean transcript with AI summary, or download the video or audio.
        </p>
      </header>

      <TranscriberTool />

      <section className="mt-16 grid gap-3 sm:grid-cols-2">
        {[
          {
            title: "Transcripts",
            body: "Accurate, timestamped speech-to-text in any language — from a link or your own files.",
          },
          {
            title: "Moment search",
            body: "Search any moment in plain English and jump straight to it.",
          },
          {
            title: "AI summaries",
            body: "One tap turns a long transcript into key takeaways.",
          },
          {
            title: "Downloads",
            body: "Save video in your chosen quality, or audio as MP3.",
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

      <section className="mt-6 overflow-hidden rounded-2xl bg-ink p-8 text-white">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-accent-soft/90 text-[#6ea8ff]">
          For clippers
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          Find clips with unexpected precision.
        </h2>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-white/70">
          Describe the moment you want in plain English — cwapa finds it and cuts
          the clip for you, ready to post.
        </p>
        <Link
          href="/clip"
          className="mt-5 inline-block rounded-full bg-white px-6 py-2.5 text-[14px] font-medium text-ink transition hover:bg-white/90"
        >
          Open Clip Finder →
        </Link>
      </section>
    </main>
  );
}

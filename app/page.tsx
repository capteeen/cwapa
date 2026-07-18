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
    </main>
  );
}

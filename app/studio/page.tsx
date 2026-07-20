import type { Metadata } from "next";
import SubtitleStudio from "@/components/SubtitleStudio";

export const metadata: Metadata = {
  title: "AI Subtitle & Caption Studio | cwapa",
  description:
    "Create editable, perfectly timed subtitles, style them for every social format, and export captioned videos, SRT, or VTT.",
};

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-14 sm:px-6 sm:pt-20">
      <header className="mx-auto mb-12 max-w-2xl text-center">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
          Caption Studio
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-[52px] sm:leading-[1.02]">
          Every word, perfectly framed.
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-[17px] leading-relaxed text-muted">
          Edit, style, and burn animated subtitles into any video. Built for the
          screen your audience is already holding.
        </p>
      </header>
      <SubtitleStudio defaultUrl={url ?? ""} />
    </main>
  );
}

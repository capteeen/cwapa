import type { Metadata } from "next";
import Link from "next/link";
import { TOOL_PAGES } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Free Tools — cwapa",
  description:
    "Free downloaders and transcript generators for YouTube, TikTok, and Instagram.",
};

export default function ToolsIndex() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-20">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Free tools.</h1>
        <p className="mx-auto mt-4 max-w-md text-[17px] text-muted">
          One tool per job — downloaders and transcript generators for every
          platform.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {TOOL_PAGES.map((t) => (
          <Link
            key={t.slug}
            href={`/tools/${t.slug}`}
            className="rounded-2xl bg-surface p-6 transition hover:bg-hairline/40"
          >
            <h2 className="text-[15px] font-semibold">{t.name}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{t.sub}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TranscriberTool from "@/components/TranscriberTool";
import { TOOL_PAGES, getToolPage } from "@/lib/tools";

export function generateStaticParams() {
  return TOOL_PAGES.map((t) => ({ slug: t.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const tool = getToolPage(params.slug);
  if (!tool) return {};
  return { title: tool.metaTitle, description: tool.metaDescription };
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  const tool = getToolPage(params.slug);
  if (!tool) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 pb-24 pt-20">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-[40px]">
          {tool.heading}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-muted">
          {tool.sub}
        </p>
      </header>

      <TranscriberTool defaultFormat={tool.defaultFormat} showHistory={false} />
    </main>
  );
}

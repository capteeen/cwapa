import Image from "next/image";
import Link from "next/link";
import ProductIcon, { type ProductIconName } from "@/components/ProductIcon";
import TranscriberTool from "@/components/TranscriberTool";
import LandingWorkflowMap from "@/components/LandingWorkflowMap";
import CreatorUseCases from "@/components/CreatorUseCases";

const features: Array<{ icon: ProductIconName; number: string; title: string; body: string; href: string }> = [
  { icon: "transcript", number: "01", title: "Transcribe anything", body: "Clean, timestamped speech-to-text from YouTube, TikTok, Instagram, or your own files.", href: "#transcribe" },
  { icon: "captions", number: "02", title: "Design the captions", body: "Edit every line, style the type, highlight spoken words, and export for every screen.", href: "/studio" },
  { icon: "clips", number: "03", title: "Find the moment", body: "Describe the clip you need in plain English. cwapa finds the timestamp and cuts it precisely.", href: "/clip" },
  { icon: "repurpose", number: "04", title: "Publish it everywhere", body: "Turn one transcript into hooks, titles, TikTok captions, X threads, and LinkedIn posts.", href: "/repurpose" },
];

export default function Home() {
  return <main className="overflow-hidden bg-[#f4f1ea]">
    <section className="relative isolate min-h-[760px] overflow-hidden bg-[#141416] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(117,214,255,.14),transparent_28%),linear-gradient(90deg,rgba(20,20,22,.98)_0%,rgba(20,20,22,.92)_38%,rgba(20,20,22,.15)_74%)]" />
      <Image src="/brand/cwapa-creator-workspace.png" alt="A cinematic cwapa creator workspace with video, waveform, and caption timeline layers" fill priority sizes="100vw" className="-z-10 object-cover object-center opacity-80 lg:object-[58%_center]" />
      <div className="relative mx-auto flex min-h-[760px] max-w-7xl items-end px-6 pb-16 pt-28 sm:px-10 lg:items-center lg:pb-0">
        <div className="max-w-[710px]">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-[.22em] text-white/65 backdrop-blur-xl"><span className="h-1.5 w-1.5 rounded-full bg-[#75d6ff] shadow-[0_0_14px_#75d6ff]" />The creator’s video workspace</div>
          <h1 className="mt-7 max-w-3xl text-[54px] font-semibold leading-[.92] tracking-[-.06em] sm:text-[76px] lg:text-[92px]">One video.<br/><span className="text-[#8edfff]">Every possibility.</span></h1>
          <p className="mt-7 max-w-xl text-[16px] leading-7 text-white/62 sm:text-[18px]">Transcribe, caption, clip, translate, and reshape your content without leaving the flow. cwapa turns raw footage into work that is ready to publish.</p>
          <div className="mt-9 flex flex-wrap gap-3"><a href="#transcribe" className="rounded-full bg-white px-7 py-3.5 text-[13px] font-semibold text-[#141416] transition hover:-translate-y-0.5 hover:bg-[#dff6ff]">Start with a video</a><Link href="/studio" className="rounded-full border border-white/25 bg-white/[.06] px-7 py-3.5 text-[13px] font-semibold text-white backdrop-blur transition hover:bg-white/10">Explore Caption Studio</Link></div>
          <div className="mt-12 flex items-center gap-5 text-[11px] text-white/40"><span>No install</span><span className="h-px w-7 bg-white/20"/><span>YouTube · TikTok · Instagram · Uploads</span></div>
        </div>
      </div>
      <div className="absolute bottom-0 right-0 hidden -translate-y-8 rotate-90 text-[9px] font-semibold uppercase tracking-[.3em] text-white/30 xl:block">From source to story</div>
    </section>

    <section id="transcribe" className="relative z-10 mx-auto -mt-1 max-w-5xl px-5 pb-28 pt-20 sm:px-8">
      <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#087cab]">Start here</p><h2 className="mt-2 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Drop in a video. Get clarity out.</h2></div><p className="max-w-sm text-[13px] leading-6 text-[#6d6a65]">Your transcript becomes the foundation for captions, clips, translations, summaries, and social content.</p></div>
      <div className="rounded-[32px] border border-black/10 bg-white p-5 shadow-[0_40px_100px_-55px_rgba(18,18,20,.5)] sm:p-9"><TranscriberTool /></div>
    </section>

    <section className="bg-[#e8e4dc] px-6 py-24 sm:px-10">
      <div className="mx-auto max-w-7xl"><div className="grid gap-10 border-b border-black/15 pb-12 lg:grid-cols-[.8fr_1.2fr]"><p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#087cab]">The cwapa workflow</p><h2 className="text-4xl font-semibold leading-[1.02] tracking-[-.05em] sm:text-6xl">Less switching.<br/>More making.</h2></div>
        <div className="grid md:grid-cols-2">{features.map((feature) => <Link href={feature.href} key={feature.number} className="group relative border-b border-black/15 py-10 md:px-8 md:odd:border-r lg:min-h-[260px] lg:px-10"><div className="flex items-start justify-between"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#141416] text-[#8edfff] transition duration-300 group-hover:-rotate-3 group-hover:scale-105"><ProductIcon name={feature.icon} /></div><span className="font-mono text-[10px] text-black/35">{feature.number}</span></div><h3 className="mt-8 text-2xl font-semibold tracking-[-.035em]">{feature.title}</h3><p className="mt-3 max-w-md text-[14px] leading-6 text-[#68645e]">{feature.body}</p><span className="absolute bottom-10 right-8 translate-x-2 text-xl opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">↗</span></Link>)}</div>
      </div>
    </section>

    <LandingWorkflowMap />

    <section className="bg-[#f4f1ea] px-5 py-24 sm:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <article className="grid overflow-hidden rounded-[34px] border border-black/10 bg-white shadow-[0_35px_90px_-55px_rgba(18,18,20,.55)] lg:grid-cols-[1.2fr_.8fr]">
          <div className="relative min-h-[420px] overflow-hidden lg:min-h-[610px]"><Image src="/brand/cwapa-caption-studio.png" alt="A vertical video with karaoke caption blocks above a precision editing timeline" fill sizes="(max-width:1024px) 100vw, 60vw" className="object-cover transition duration-700 hover:scale-[1.02]"/><div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"/><span className="absolute bottom-5 left-5 rounded-full border border-white/30 bg-black/30 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.18em] text-white backdrop-blur-xl">Frame-perfect captions</span></div>
          <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-14"><div><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#141416] text-[#75d6ff]"><ProductIcon name="captions"/></div><p className="mt-10 text-[10px] font-bold uppercase tracking-[.22em] text-[#087cab]">Caption Studio</p><h2 className="mt-3 text-4xl font-semibold leading-[1] tracking-[-.05em] sm:text-5xl">Make every word part of the picture.</h2><p className="mt-6 text-[14px] leading-7 text-[#6b6761]">Edit timing on the timeline, shape the typography, choose the canvas, and let karaoke highlighting follow the speaker naturally.</p></div><Link href="/studio" className="mt-10 inline-flex w-fit items-center gap-3 rounded-full bg-[#141416] px-6 py-3 text-[12px] font-semibold text-white transition hover:bg-[#087cab]">Open Caption Studio <span>↗</span></Link></div>
        </article>

        <article className="grid overflow-hidden rounded-[34px] bg-[#141416] text-white shadow-[0_35px_90px_-55px_rgba(18,18,20,.7)] lg:grid-cols-[.76fr_1.24fr]">
          <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-14"><div><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#087cab]"><ProductIcon name="repurpose"/></div><p className="mt-10 text-[10px] font-bold uppercase tracking-[.22em] text-[#75d6ff]">Content Repurposer</p><h2 className="mt-3 text-4xl font-semibold leading-[1] tracking-[-.05em] sm:text-5xl">One thought, shaped for every channel.</h2><p className="mt-6 text-[14px] leading-7 text-white/55">Keep the facts and your voice. Change the structure, rhythm, and opening for TikTok, X, LinkedIn, hooks, and titles.</p></div><Link href="/repurpose" className="mt-10 inline-flex w-fit items-center gap-3 rounded-full bg-[#75d6ff] px-6 py-3 text-[12px] font-semibold text-[#111113] transition hover:bg-white">Repurpose a transcript <span>↗</span></Link></div>
          <div className="relative min-h-[420px] overflow-hidden lg:min-h-[610px]"><Image src="/brand/cwapa-content-repurposer.png" alt="A transcript ribbon transforming into multiple content formats" fill sizes="(max-width:1024px) 100vw, 62vw" className="object-cover transition duration-700 hover:scale-[1.02]"/><div className="absolute inset-0 bg-gradient-to-r from-[#141416]/45 via-transparent to-transparent"/></div>
        </article>
      </div>
    </section>

    <CreatorUseCases />

    <section className="bg-[#141416] px-6 py-24 text-white sm:px-10"><div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.15fr_.85fr]"><div><p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#75d6ff]">Built for momentum</p><h2 className="mt-5 text-5xl font-semibold leading-[.96] tracking-[-.055em] sm:text-7xl">Your work remembers<br/>where you left off.</h2><p className="mt-7 max-w-xl text-[15px] leading-7 text-white/55">Sign in to save transcripts, organize projects into folders, reopen source videos, and move directly from a transcript into Caption Studio or the Content Repurposer.</p><Link href="/auth" className="mt-9 inline-flex rounded-full bg-[#75d6ff] px-7 py-3.5 text-[13px] font-semibold text-[#101012] transition hover:bg-white">Create your workspace</Link></div><figure className="relative aspect-[4/5] overflow-hidden rounded-[32px] border border-white/10 bg-[#111214] shadow-[0_42px_90px_-52px_rgba(0,0,0,.9)]"><Image src="/brand/cwapa-transcript-library.png" alt="A signed-in cwapa workspace with three saved media transcript projects" fill sizes="(max-width:1024px) 100vw, 40vw" className="object-cover"/></figure></div></section>
  </main>;
}

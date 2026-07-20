import { BrandMark } from "@/components/BrandLogo";
import ProductIcon, { type ProductIconName } from "@/components/ProductIcon";

const outputs: Array<{ icon: ProductIconName; title: string; detail: string }> = [
  { icon: "transcript", title: "Transcript", detail: "Timed & searchable" },
  { icon: "captions", title: "Captions", detail: "Styled & animated" },
  { icon: "clips", title: "Clips", detail: "Found by meaning" },
  { icon: "translate", title: "Translation", detail: "10 languages" },
  { icon: "repurpose", title: "Social content", detail: "5 ready formats" },
  { icon: "library", title: "Project library", detail: "Saved & organized" },
];

export default function LandingWorkflowMap() {
  return <section className="bg-[#e8e4dc] px-5 pb-24 sm:px-10">
    <div className="mx-auto max-w-7xl rounded-[36px] bg-[#151517] p-5 text-white shadow-[0_45px_100px_-60px_rgba(10,10,12,.8)] sm:p-9 lg:p-12">
      <header className="grid gap-5 border-b border-white/10 pb-9 lg:grid-cols-[.75fr_1.25fr]"><p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#75d6ff]">One connected system</p><div><h2 className="text-4xl font-semibold leading-[1] tracking-[-.05em] sm:text-6xl">A source goes in.<br/>A whole workflow opens.</h2><p className="mt-5 max-w-2xl text-[14px] leading-7 text-white/48">cwapa understands the transcript once, then carries its timing and meaning into every tool that follows.</p></div></header>
      <div className="relative mt-10 grid items-center gap-8 lg:grid-cols-[.72fr_.36fr_1.4fr]">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">{["Video link", "Media upload", "Saved project"].map((source, index) => <div key={source} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.045] px-4 py-4"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/8 font-mono text-[10px] text-[#75d6ff]">0{index + 1}</span><span className="text-[12px] font-semibold text-white/75">{source}</span></div>)}</div>
        <div className="relative mx-auto grid h-24 w-24 place-items-center rounded-[28px] border border-[#75d6ff]/25 bg-[#75d6ff]/10 shadow-[0_0_65px_rgba(117,214,255,.14)]"><span className="absolute -inset-3 animate-pulse rounded-[34px] border border-[#75d6ff]/10"/><BrandMark className="h-14 w-14 text-[#202024]"/><span className="absolute -bottom-7 text-[9px] font-bold uppercase tracking-[.2em] text-white/35">Meaning layer</span></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{outputs.map((output) => <div key={output.title} className="group rounded-2xl border border-white/10 bg-white/[.045] p-4 transition hover:-translate-y-1 hover:border-[#75d6ff]/30 hover:bg-white/[.07]"><div className="flex items-center justify-between"><ProductIcon name={output.icon} className="h-5 w-5 text-[#75d6ff]"/><span className="h-1.5 w-1.5 rounded-full bg-white/15 transition group-hover:bg-[#75d6ff]"/></div><p className="mt-5 text-[13px] font-semibold">{output.title}</p><p className="mt-1 text-[10px] text-white/35">{output.detail}</p></div>)}</div>
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" preserveAspectRatio="none"><path d="M 260 150 C 330 150, 330 150, 400 150" stroke="rgba(117,214,255,.35)" strokeWidth="1" fill="none" strokeDasharray="4 8"/><path d="M 495 150 C 560 150, 560 70, 630 70 M 495 150 C 560 150, 560 150, 630 150 M 495 150 C 560 150, 560 230, 630 230" stroke="rgba(117,214,255,.26)" strokeWidth="1" fill="none" strokeDasharray="4 8"/></svg>
      </div>
    </div>
  </section>;
}

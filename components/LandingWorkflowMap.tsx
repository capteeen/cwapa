import Image from "next/image";

export default function LandingWorkflowMap() {
  return (
    <section className="bg-[#e8e4dc] px-5 pb-24 sm:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto mb-10 max-w-4xl text-center sm:mb-14">
          <p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#168fbd]">
            One connected system
          </p>
          <h2 className="mt-5 text-4xl font-semibold leading-[.98] tracking-[-.055em] text-[#151517] sm:text-6xl">
            A source goes in.
            <br />
            A whole workflow opens.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[14px] leading-7 text-[#151517]/55">
            cwapa understands the transcript once, then carries its timing and meaning into every tool that follows.
          </p>
        </header>

        <figure className="relative aspect-[16/9] overflow-hidden rounded-[30px] border border-black/10 bg-[#0b0c0e] shadow-[0_42px_90px_-52px_rgba(10,10,12,.72)] sm:rounded-[42px]">
          <Image
            src="/brand/cwapa-connected-workflow.png"
            alt="Three media sources flow through cwapa's audio intelligence into six creator tools"
            fill
            priority={false}
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
          />
        </figure>
      </div>
    </section>
  );
}

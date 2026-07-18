import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — cwapa",
  description: "cwapa is free while in beta. Pro plans are coming soon.",
};

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "during beta",
    features: [
      "Link & file transcription",
      "AI summaries",
      "MP4 & MP3 downloads",
      "Text & SRT export",
    ],
    cta: "You're on it",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "per month",
    features: [
      "Everything in Free",
      "Longer videos & priority speed",
      "Transcript library & search",
      "Translation to 100+ languages",
    ],
    cta: "Coming soon",
    highlight: true,
  },
  {
    name: "Business",
    price: "$29",
    period: "per user / month",
    features: [
      "Everything in Pro",
      "Team workspaces",
      "API access",
      "Priority support",
    ],
    cta: "Coming soon",
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-20">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Free while in beta.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[17px] text-muted">
          Use everything for free today. Paid plans arrive when the beta ends.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`rounded-2xl p-7 ${
              p.highlight ? "bg-ink text-white" : "bg-surface"
            }`}
          >
            <h2 className="text-[15px] font-semibold">{p.name}</h2>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {p.price}
              <span
                className={`ml-1.5 text-[13px] font-normal ${
                  p.highlight ? "text-white/60" : "text-muted"
                }`}
              >
                {p.period}
              </span>
            </p>
            <ul
              className={`mt-5 space-y-2 text-[13px] leading-relaxed ${
                p.highlight ? "text-white/80" : "text-muted"
              }`}
            >
              {p.features.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
            <div
              className={`mt-7 rounded-full py-2.5 text-center text-[13px] font-medium ${
                p.highlight
                  ? "bg-white text-ink"
                  : "border border-hairline text-muted"
              }`}
            >
              {p.cta}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

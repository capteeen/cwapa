"use client";

import { useState } from "react";

interface Plan {
  name: string;
  monthly: number | null;
  features: string[];
  cta: string;
  highlight: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    monthly: null,
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
    monthly: 6.99,
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
    monthly: 19.99,
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

function priceFor(plan: Plan, yearly: boolean): { price: string; period: string; note?: string } {
  if (plan.monthly === null) return { price: "$0", period: "during beta" };
  if (!yearly) return { price: `$${plan.monthly.toFixed(2)}`, period: "per month" };
  const perMonth = plan.monthly / 2;
  const perYear = perMonth * 12;
  return {
    price: `$${perMonth.toFixed(2)}`,
    period: "per month",
    note: `billed $${perYear.toFixed(2)} yearly`,
  };
}

export default function PricingTable() {
  const [yearly, setYearly] = useState(true);

  return (
    <div>
      <div className="mb-8 flex justify-center">
        <div className="flex rounded-full bg-surface p-1 text-[13px] font-medium">
          <button
            onClick={() => setYearly(false)}
            className={`rounded-full px-5 py-1.5 transition ${
              !yearly ? "bg-white text-ink shadow-sm" : "text-muted"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`rounded-full px-5 py-1.5 transition ${
              yearly ? "bg-white text-ink shadow-sm" : "text-muted"
            }`}
          >
            Yearly <span className="text-accent">· save 50%</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => {
          const { price, period, note } = priceFor(p, yearly);
          return (
            <div
              key={p.name}
              className={`rounded-2xl p-7 ${
                p.highlight ? "bg-ink text-white" : "bg-surface"
              }`}
            >
              <h2 className="text-[15px] font-semibold">{p.name}</h2>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {price}
                <span
                  className={`ml-1.5 text-[13px] font-normal ${
                    p.highlight ? "text-white/60" : "text-muted"
                  }`}
                >
                  {period}
                </span>
              </p>
              <p
                className={`mt-1 h-4 text-[12px] ${
                  p.highlight ? "text-white/50" : "text-muted/80"
                }`}
              >
                {note ?? ""}
              </p>
              <ul
                className={`mt-4 space-y-2 text-[13px] leading-relaxed ${
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
          );
        })}
      </div>
    </div>
  );
}

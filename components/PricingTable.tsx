"use client";

import React, { useState } from "react";

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
      "10 transcriptions per month",
      "Videos up to 30 minutes",
      "Uploads up to 100 MB",
      "Downloads up to 720p",
      "5 AI summaries per month",
    ],
    cta: "You're on it",
    highlight: false,
  },
  {
    name: "Pro",
    monthly: 6.99,
    features: [
      "Unlimited transcriptions",
      "Videos up to 4 hours",
      "Uploads up to 2 GB",
      "Best-quality downloads (incl. 4K)",
      "Unlimited AI summaries",
      "Priority processing",
    ],
    cta: "Coming soon",
    highlight: true,
  },
  {
    name: "Business",
    monthly: 19.99,
    features: [
      "Everything in Pro",
      "Team workspace & shared library",
      "Batch transcription",
      "API access",
      "Priority support",
    ],
    cta: "Coming soon",
    highlight: false,
  },
];

type Cell = string | boolean;

const COMPARISON: { section: string; rows: [string, Cell, Cell, Cell][] }[] = [
  {
    section: "Transcription",
    rows: [
      ["Transcriptions per month", "10", "Unlimited", "Unlimited"],
      ["Max video length", "30 min", "4 hours", "4 hours"],
      ["File uploads", "100 MB", "2 GB", "2 GB"],
      ["Languages", "99+", "99+", "99+"],
      ["Timestamps & SRT export", true, true, true],
      ["Priority processing", false, true, true],
    ],
  },
  {
    section: "AI",
    rows: [
      ["AI summaries", "5 / month", "Unlimited", "Unlimited"],
      ["Transcript translation", "10 languages", "10 languages", "10 languages"],
      ["Transcript library & search (coming soon)", false, true, true],
    ],
  },
  {
    section: "Downloads",
    rows: [
      ["MP4 video downloads", "Up to 720p", "Best quality (incl. 4K)", "Best quality (incl. 4K)"],
      ["MP3 audio extraction", true, true, true],
      ["Batch downloads", false, false, true],
    ],
  },
  {
    section: "Teams & developers",
    rows: [
      ["Team workspace & shared library", false, false, true],
      ["Seats", "1", "1", "Unlimited (per user)"],
      ["API access", false, false, true],
      ["Support", "Community", "Email", "Priority"],
    ],
  },
];

function CellValue({ value, dark }: { value: Cell; dark?: boolean }) {
  if (value === true)
    return <span className="text-accent">✓</span>;
  if (value === false)
    return <span className={dark ? "text-white/30" : "text-hairline"}>—</span>;
  return <>{value}</>;
}

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

      <section className="mt-20">
        <h2 className="mb-2 text-center text-2xl font-semibold tracking-tight">
          Compare plans.
        </h2>
        <p className="mb-8 text-center text-[13px] text-muted">
          During the beta everything is unlocked — these limits apply when paid
          plans launch.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left">
                <th className="w-[34%] pb-3 font-medium text-muted"></th>
                <th className="w-[22%] pb-3 font-semibold">Free</th>
                <th className="w-[22%] pb-3 font-semibold text-accent">Pro</th>
                <th className="w-[22%] pb-3 font-semibold">Business</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((group) => (
                <React.Fragment key={group.section}>
                  <tr>
                    <td
                      colSpan={4}
                      className="pb-2 pt-6 text-[11px] font-semibold uppercase tracking-wide text-muted"
                    >
                      {group.section}
                    </td>
                  </tr>
                  {group.rows.map(([label, free, pro, biz]) => (
                    <tr key={label} className="border-t border-hairline/50">
                      <td className="py-3 pr-4 text-muted">{label}</td>
                      <td className="py-3 pr-4">
                        <CellValue value={free} />
                      </td>
                      <td className="py-3 pr-4">
                        <CellValue value={pro} />
                      </td>
                      <td className="py-3">
                        <CellValue value={biz} />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

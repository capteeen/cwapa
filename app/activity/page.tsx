import type { Metadata } from "next";
import ReliabilityDashboard from "@/components/ReliabilityDashboard";

export const metadata: Metadata = { title: "Usage & Render History | cwapa" };

export default function ActivityPage() {
  return <main className="mx-auto max-w-6xl px-5 pb-24 pt-28 sm:px-8"><ReliabilityDashboard /></main>;
}

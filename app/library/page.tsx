import type { Metadata } from "next";
import LibraryClient from "@/components/LibraryClient";

export const metadata: Metadata = { title: "Transcript Library | cwapa" };

export default function LibraryPage() {
  return <main className="mx-auto w-full max-w-7xl px-6 pb-24 pt-14"><LibraryClient /></main>;
}

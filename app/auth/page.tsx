import type { Metadata } from "next";
import AuthPanel from "@/components/AuthPanel";

export const metadata: Metadata = { title: "Sign in | cwapa" };

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; verified?: string }> }) {
  const query = await searchParams;

  return (
    <main className="min-h-[75vh] bg-[radial-gradient(circle_at_50%_10%,rgba(0,113,227,0.08),transparent_36%)] px-6 py-20">
      <AuthPanel next={query.next} verified={query.verified === "1"} />
    </main>
  );
}

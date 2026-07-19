import type { Metadata } from "next";
import CookieAdmin from "@/components/CookieAdmin";

export const metadata: Metadata = {
  title: "Cookie admin — cwapa",
  robots: { index: false, follow: false },
};

export default function CookieAdminPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 pb-24 pt-20">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Refresh YouTube cookies
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-muted">
          When YouTube starts blocking downloads, export a fresh{" "}
          <code className="rounded bg-surface px-1.5 py-0.5">cookies.txt</code>{" "}
          from a logged-in browser and paste it here — it takes effect
          immediately, no redeploy.
        </p>
      </header>
      <CookieAdmin />
    </main>
  );
}

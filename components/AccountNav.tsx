"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getInsForgeBrowserClient, isInsForgeConfigured } from "@/lib/insforge";

export default function AccountNav() {
  const [account, setAccount] = useState<{ signedIn: boolean; label?: string } | null>(null);

  useEffect(() => {
    if (!isInsForgeConfigured()) { setAccount({ signedIn: false }); return; }
    let active = true;
    getInsForgeBrowserClient().auth.getCurrentUser().then(({ data }) => {
      if (!active) return;
      const user = data?.user;
      const profile = user?.profile as { name?: string; displayName?: string } | null | undefined;
      const metadata = user?.metadata as { name?: string } | null | undefined;
      const label = profile?.name || profile?.displayName || metadata?.name || user?.email?.split("@")[0];
      setAccount({ signedIn: Boolean(user), label });
    }).catch(() => { if (active) setAccount({ signedIn: false }); });
    return () => { active = false; };
  }, []);

  if (account === null) return <span className="hidden h-8 w-24 animate-pulse rounded-full bg-surface md:block" />;
  return account.signedIn ? <Link href="/library" aria-label="Open your signed-in workspace" className="group flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-300"><span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[9px] uppercase text-white">{account.label?.[0] ?? "U"}<span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border border-white bg-emerald-500" /></span><span className="hidden max-w-20 truncate sm:block">{account.label || "Signed in"}</span><span className="hidden text-emerald-600 lg:inline">· Signed in</span></Link> : <Link href="/auth" className="rounded-full bg-surface px-3 py-1.5 text-[11px] font-medium text-muted hover:text-ink">Sign in</Link>;
}

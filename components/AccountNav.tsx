"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getInsForgeBrowserClient, isInsForgeConfigured } from "@/lib/insforge";

export default function AccountNav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isInsForgeConfigured()) { setSignedIn(false); return; }
    let active = true;
    getInsForgeBrowserClient().auth.getCurrentUser().then(({ data }) => {
      if (active) setSignedIn(Boolean(data?.user));
    }).catch(() => { if (active) setSignedIn(false); });
    return () => { active = false; };
  }, []);

  if (signedIn === null) return <span className="hidden h-7 w-16 animate-pulse rounded-full bg-surface md:block" />;
  return signedIn ? <Link href="/library" className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-medium text-white">Library</Link> : <Link href="/auth" className="rounded-full bg-surface px-3 py-1.5 text-[11px] font-medium text-muted hover:text-ink">Sign in</Link>;
}

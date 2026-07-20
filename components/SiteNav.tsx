"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountNav from "@/components/AccountNav";
import BrandLogo from "@/components/BrandLogo";

const links = [
  { href: "/studio", label: "Caption Studio", visibility: "hidden md:block" },
  { href: "/repurpose", label: "Repurpose", visibility: "hidden sm:block" },
  { href: "/tools", label: "Tools", visibility: "hidden sm:block" },
  { href: "/pricing", label: "Pricing", visibility: "block" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const shell = isHome
    ? "border-white/35 bg-white/[.08]"
    : "border-black/[.06] bg-white/90";
  const foreground = isHome
    ? "text-white mix-blend-difference hover:opacity-70"
    : "text-[#171719] hover:text-black";

  return (
    <nav className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <div
        className={`pointer-events-auto mx-auto flex max-w-5xl items-center justify-between rounded-full border px-4 py-2.5 shadow-[0_16px_50px_-24px_rgba(12,18,28,.55)] backdrop-blur-2xl sm:px-5 ${shell}`}
      >
        <BrandLogo adaptive={isHome} />
        <div className="flex items-center gap-3 text-[13px] sm:gap-6 sm:text-[14px]">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`${link.visibility} transition ${foreground} ${active ? "font-semibold" : "font-medium"}`}
              >
                {link.label}
              </Link>
            );
          })}
          <AccountNav />
        </div>
      </div>
    </nav>
  );
}

import Link from "next/link";

export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className} fill="none">
      <rect width="40" height="40" rx="12" fill="currentColor" />
      <path d="M11 15.5c2.4-4.5 8.5-5.7 12.7-2.7 1.2.9 2.2 2 3.4 2.7 1.5.9 2.7.7 3.9-.1" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M9 21.2c2.9 0 3.6-6.4 6.3-6.4 2.9 0 3.2 11.4 6.1 11.4 2.8 0 3.4-7.2 6.1-7.2 1.2 0 2.1 1.1 3.5 1.1" stroke="#75D6FF" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M11.8 29.1h16.4" stroke="white" strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

export default function BrandLogo({
  inverted = false,
  adaptive = false,
}: {
  inverted?: boolean;
  adaptive?: boolean;
}) {
  const foreground = adaptive
    ? "text-white mix-blend-difference"
    : inverted
      ? "text-white"
      : "text-ink";

  return (
    <Link
      href="/"
      aria-label="cwapa home"
      className={`inline-flex items-center gap-2.5 ${foreground}`}
    >
      <BrandMark className="h-8 w-8" />
      <span className="text-[20px] font-semibold tracking-[-0.055em]">cwapa</span>
    </Link>
  );
}

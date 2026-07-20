export type ProductIconName = "transcript" | "captions" | "clips" | "repurpose" | "translate" | "library";

export default function ProductIcon({ name, className = "h-6 w-6" }: { name: ProductIconName; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common}>
    {name === "transcript" && <><path d="M5 4.5h9l5 5V20H5z"/><path d="M14 4.5V10h5M8 14h8M8 17h6"/></>}
    {name === "captions" && <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 14c1.2-3.4 2-3.4 3.2 0s2 3.4 3.2 0 2-3.4 3.6 0"/></>}
    {name === "clips" && <><circle cx="7" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><path d="m9.4 8.8 10.1 7.7M9.4 15.2 19.5 7.5"/></>}
    {name === "repurpose" && <><path d="M7 4H4v3M17 20h3v-3M4.5 7A8 8 0 0 1 18 5M19.5 17A8 8 0 0 1 6 19"/><path d="M9 9h6v6H9z"/></>}
    {name === "translate" && <><path d="M4 5h9M8.5 3v2M6 8c1.5 2.6 3.2 4.2 6 5M12 8c-1.5 3-3.5 5.2-7 7M14 20l3.2-8 3.3 8M15.2 17h4"/></>}
    {name === "library" && <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 5.5v15M8 7h8"/></>}
  </svg>;
}

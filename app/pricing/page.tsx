import type { Metadata } from "next";
import PricingTable from "@/components/PricingTable";

export const metadata: Metadata = {
  title: "Pricing — cwapa",
  description:
    "cwapa is free while in beta. Pro from $3.49/mo billed yearly. Business plans for teams.",
};

export default function Pricing() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-20">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Free while in beta.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[17px] text-muted">
          Use everything for free today. Paid plans arrive when the beta ends.
        </p>
      </header>

      <PricingTable />
    </main>
  );
}

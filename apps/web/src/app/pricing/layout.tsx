import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pricing & Plans — UPSC Current Affairs, Tests & Mentorship",
  description:
    "Transparent pricing for UPSC Civil Services preparation. Access daily current affairs, editorial analysis, custom tests, smart notes, and 1:1 mentorship from toppers.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing & Plans — WayToIAS UPSC Preparation",
    description:
      "Transparent pricing for UPSC Civil Services preparation. Access daily current affairs, editorial analysis, custom tests, smart notes, and 1:1 mentorship from toppers.",
    url: "/pricing",
    type: "website"
  }
};

export default function PricingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

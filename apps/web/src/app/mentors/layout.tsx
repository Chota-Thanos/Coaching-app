import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "UPSC Mentors & Verified Toppers — 1:1 Guidance & Copy Evaluation",
  description:
    "Connect with verified UPSC CSE toppers, rank holders, and civil service mentors for 1:1 strategy consultation, study plans, and Mains answer evaluation.",
  alternates: { canonical: "/mentors" },
  openGraph: {
    title: "UPSC Mentors & Verified Toppers — WayToIAS",
    description:
      "Connect with verified UPSC CSE toppers, rank holders, and civil service mentors for 1:1 strategy consultation, study plans, and Mains answer evaluation.",
    url: "/mentors",
    type: "website"
  }
};

export default function MentorsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

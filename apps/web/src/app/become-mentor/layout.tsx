import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Become a UPSC Mentor — Guide Serious Aspirants",
  description:
    "Join the WayToIAS mentor network. Evaluate Mains copies, offer 1:1 guidance sessions, and mentor UPSC CSE aspirants on their path to success.",
  alternates: { canonical: "/become-mentor" },
  openGraph: {
    title: "Become a UPSC Mentor — WayToIAS",
    description:
      "Join the WayToIAS mentor network. Evaluate Mains copies, offer 1:1 guidance sessions, and mentor UPSC CSE aspirants on their path to success.",
    url: "/become-mentor",
    type: "website"
  }
};

export default function BecomeMentorLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

import type { Metadata } from "next";
import { ForkReader } from "../../../../../components/current-affairs/workspace/fork-reader";

type ForkReaderPageProps = {
  params: Promise<{ forkId: string }>;
};

export const metadata: Metadata = {
  title: "Saved Article",
  description: "Read and annotate your saved current affairs article.",
  robots: { index: false, follow: false }
};

export default async function ForkReaderPage({ params }: ForkReaderPageProps) {
  const { forkId } = await params;
  return <ForkReader forkId={forkId} />;
}

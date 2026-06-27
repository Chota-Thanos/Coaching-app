import type { Metadata } from "next";
import { RepositoryDetail } from "../../../../../components/current-affairs/workspace/repository-detail";

type RepositoryPageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Notes Repository",
  description: "Student current affairs notes repository.",
  robots: { index: false, follow: false }
};

export default async function RepositoryPage({ params }: RepositoryPageProps) {
  const { id } = await params;
  return <RepositoryDetail id={id} />;
}

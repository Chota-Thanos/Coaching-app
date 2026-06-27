import type { Metadata } from "next";
import { CategoryDetailPage } from "../../../../components/assessment/category-detail-page";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ nodeId: string }>;
};

export const metadata: Metadata = {
  title: "Category Details & Practice",
  description: "Create customized tests and view performance breakdown for syllabus category.",
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { nodeId } = await params;
  return <CategoryDetailPage nodeId={parseInt(nodeId, 10)} />;
}

import type { Metadata } from "next";
import { CategoryPerformancePage } from "../../../../../components/assessment/category-performance-page";

type CategoryPerformanceRouteProps = {
  params: Promise<{ nodeId: string }>;
};

export const metadata: Metadata = {
  title: "Category Performance",
  robots: { index: false, follow: false }
};

export default async function CategoryPerformanceRoute({ params }: CategoryPerformanceRouteProps) {
  const { nodeId } = await params;
  return <CategoryPerformancePage nodeId={nodeId} />;
}

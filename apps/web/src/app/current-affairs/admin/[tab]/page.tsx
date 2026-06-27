import { redirect } from "next/navigation";

// Map old tab slugs to new admin module routes
const TAB_MAP: Record<string, string> = {
  overview: "/admin/current-affairs/overview",
  articles: "/admin/current-affairs/articles",
  create_article: "/admin/current-affairs/create",
  categories: "/admin/current-affairs/categories",
  ingestion: "/admin/current-affairs/ingestion",
  ai_settings: "/admin/current-affairs/ai-settings",
  quiz_creator: "/admin/assessment/create-objective",
  quiz_library: "/admin/assessment/objective-questions",
  mains_questions: "/admin/assessment/mains-questions",
  assessment_taxonomy: "/admin/assessment/assessment-categories",
};

export default async function OldAdminTabRedirect({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const destination = TAB_MAP[tab] ?? "/admin/current-affairs/overview";
  redirect(destination);
}

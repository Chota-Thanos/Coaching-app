import type { Metadata } from "next";
import { WorkspaceAiHelper } from "../../../../components/current-affairs/workspace/workspace-ai-helper";

export const metadata: Metadata = {
  title: "AI Notes Helper",
  description: "AI study notes compiler and self-assessment portal for current affairs.",
  alternates: { canonical: "/current-affairs/workspace/ai-helper" },
  robots: { index: false, follow: false }
};

export default function StudentAiHelperPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 space-y-6">
      <div>
        <h1 className="text-3xl font-black text-ink">AI Notes Helper</h1>
        <p className="text-sm text-ink/65 mt-1">Compile personalized study notes or run assessment quizzes tailored to your syllabus.</p>
      </div>
      <WorkspaceAiHelper />
    </main>
  );
}

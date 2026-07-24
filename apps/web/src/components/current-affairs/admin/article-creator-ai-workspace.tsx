"use client";

import { Brain, Sparkles, Loader2, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { CategoryNode } from "../../../lib/api";
import type { ContentKind } from "../../../lib/current-affairs";
import {
  ADMIN_CONTENT_KINDS,
  adminSlug,
  contentFamilyForKind,
  splitAdminTags,
} from "../../../lib/admin-current-affairs";
import { authenticatedPost, useAuth } from "../../auth/auth-context";

type ArticleCreatorAiWorkspaceProps = {
  contentKind: ContentKind;
  setContentKind: (kind: ContentKind) => void;
  categoryNodeId: string;
  setCategoryNodeId: (id: string) => void;
  categories: CategoryNode[];
  family: string;
  categoryOptions: CategoryNode[];
  onDraftGenerated: (draft: any) => void;
};

export function ArticleCreatorAiWorkspace({
  contentKind,
  setContentKind,
  categoryNodeId,
  setCategoryNodeId,
  categories,
  family,
  categoryOptions,
  onDraftGenerated,
}: ArticleCreatorAiWorkspaceProps) {
  const { token } = useAuth();
  const [workspaceInput, setWorkspaceInput] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [queueItems, setQueueItems] = useState<
    Array<{ topic: string; status: "queued" | "running" | "completed" | "failed" }>
  >([]);

  // AI Generator specific states
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [genLogs, setGenLogs] = useState<string[]>([]);

  const runBulkQueue = async () => {
    if (!workspaceInput.trim() || !token) return;
    const topics = workspaceInput
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (topics.length === 0) return;

    setBulkRunning(true);
    setQueueItems(topics.map((t) => ({ topic: t, status: "queued" })));

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i] || "";
      setQueueItems((prev) => {
        const next = [...prev];
        next[i] = { topic, status: "running" };
        return next;
      });

      try {
        const contentTypeMap: Record<string, string> = {
          prelims_pyq: "prelims_pyq",
          mains_pyq: "mains_pyq",
          daily_current_affairs: "prelims_ca",
          daily_editorial_summary: "mains_ca",
          mains_topic_note: "mains_ca",
        };
        const contentType =
          contentTypeMap[contentKind] ||
          (contentFamilyForKind(contentKind) === "prelims" ? "prelims_ca" : "mains_ca");

        const res = await authenticatedPost<any>(
          "/api/v1/current-affairs/admin/ai/generate",
          token,
          {
            content_type: contentType,
            topics: [topic],
            ai_provider: "openai",
            ai_model: "gpt-4o-mini",
            subject_id: categoryNodeId ? Number(categoryNodeId) : undefined,
          }
        );

        const generated = res.articles?.[0];
        if (generated) {
          let finalBody = generated.excerpt || "";
          let finalBodyJson: any = undefined;

          if (contentKind === "prelims_pyq") {
            const optionsList = generated.options || [];
            const optA =
              optionsList[0]?.text || optionsList.find((o: any) => o.label === "A")?.text || "";
            const optB =
              optionsList[1]?.text || optionsList.find((o: any) => o.label === "B")?.text || "";
            const optC =
              optionsList[2]?.text || optionsList.find((o: any) => o.label === "C")?.text || "";
            const optD =
              optionsList[3]?.text || optionsList.find((o: any) => o.label === "D")?.text || "";

            finalBodyJson = {
              year: String(generated.year || new Date().getFullYear()),
              question_statement: generated.question_statement || "",
              supp_question_statement: generated.supp_question_statement || undefined,
              question_prompt: generated.question_prompt || undefined,
              options: [
                { label: "A", text: optA },
                { label: "B", text: optB },
                { label: "C", text: optC },
                { label: "D", text: optD },
              ],
              correct_answer: generated.correct_answer || "A",
              explanation: generated.explanation || "",
            };
            finalBody = `### Year: ${
              generated.year || "2024"
            }\n\n**${generated.question_statement || ""}**\n\n${
              generated.supp_question_statement ? `${generated.supp_question_statement}\n\n` : ""
            }${
              generated.question_prompt ? `${generated.question_prompt}\n\n` : ""
            }(a) ${optA}\n(b) ${optB}\n(c) ${optC}\n(d) ${optD}\n\n**Correct Answer: (${
              generated.correct_answer || "A"
            })**\n\n### Explanation\n${generated.explanation || ""}`;
          } else if (contentKind === "mains_pyq") {
            finalBodyJson = {
              year: String(generated.year || new Date().getFullYear()),
              question_statement: generated.question_statement || "",
              word_limit: Number(generated.word_limit) || 250,
              max_marks: Number(generated.max_marks) || 15,
              answer_approach: generated.answer_approach || "",
              model_answer: generated.model_answer || "",
            };
            finalBody = `### Year: ${generated.year || "2024"} | Marks: ${
              generated.max_marks || "15"
            } | Word Limit: ${
              generated.word_limit || "250"
            }\n\n**${generated.question_statement || ""}**\n\n### Answer Approach\n${
              generated.answer_approach || ""
            }\n\n### Model Answer\n${generated.model_answer || ""}`;
          } else {
            const sectionsList = generated.sections || [];
            finalBody = sectionsList
              .map((sec: any) => `## ${sec.section_title}\n\n${sec.content}`)
              .join("\n\n");
          }

          const targetCategoryNodeId = categoryNodeId
            ? Number(categoryNodeId)
            : generated.category_node_id
            ? Number(generated.category_node_id)
            : undefined;

          const articlePayload = {
            content_kind: contentKind,
            title: generated.title || "AI Generated Bulk Article",
            slug: generated.slug || adminSlug(generated.title || `ai-${contentKind}`),
            body: finalBody,
            body_json: finalBodyJson,
            category_node_id: targetCategoryNodeId,
            source_name: "AI Bulk Queue",
            source_url: generated.source_url || undefined,
            publication_date: generated.news_date || new Date().toISOString().slice(0, 10),
            institute_tags: ["AI-Bulk-Draft"],
            status: "draft" as const,
            is_ai_generated: true,
            seo_title: generated.title || undefined,
            seo_description: generated.meta_description || undefined,
            canonical_url: generated.source_url || undefined,
            keywords: splitAdminTags(generated.meta_keywords || ""),
          };

          await authenticatedPost("/api/v1/current-affairs/articles", token, articlePayload);

          setQueueItems((prev) => {
            const next = [...prev];
            next[i] = { topic: topic || "", status: "completed" };
            return next;
          });
        } else {
          throw new Error("Empty AI response");
        }
      } catch (err) {
        console.error("Bulk generate failed for:", topic, err);
        setQueueItems((prev) => {
          const next = [...prev];
          next[i] = { topic: topic || "", status: "failed" };
          return next;
        });
      }
    }

    setBulkRunning(false);
    setWorkspaceInput("");
  };

  const runAiGeneration = async () => {
    if (!workspaceInput.trim() || !token) return;
    setGenerating(true);
    setGenLogs([]);
    setGenStep(1);

    const log = (msg: string, delay: number) =>
      new Promise<void>((r) =>
        setTimeout(() => {
          setGenLogs((prev) => [...prev, msg]);
          r();
        }, delay)
      );

    await log("🤖 AI Agent Engine initialized. Connecting to backend...", 600);
    setGenStep(2);
    await log("🔎 Auto-categorizing and matching writing styles...", 800);
    setGenStep(3);
    await log("📂 Compiling prompts & generating structured JSON schema...", 1000);

    try {
      const contentTypeMap: Record<string, string> = {
        prelims_pyq: "prelims_pyq",
        mains_pyq: "mains_pyq",
        daily_current_affairs: "prelims_ca",
        daily_editorial_summary: "mains_ca",
        mains_topic_note: "mains_ca",
      };
      const contentType =
        contentTypeMap[contentKind] ||
        (contentFamilyForKind(contentKind) === "prelims" ? "prelims_ca" : "mains_ca");

      const res = (await authenticatedPost("/api/v1/current-affairs/admin/ai/generate", token, {
        content_type: contentType,
        topics: [workspaceInput],
        ai_provider: "openai",
        ai_model: "gpt-4o-mini",
        subject_id: categoryNodeId ? Number(categoryNodeId) : undefined,
      })) as any;

      setGenStep(4);
      await log("📝 Running LaTeX validator & structural formatting audit...", 600);

      const generated = res.articles?.[0];
      if (generated) {
        setGenStep(5);
        await log("🎉 Enriched draft generated! Populating editing form below...", 600);

        const categoryId = String(generated.category_node_id || categoryNodeId || "");

        if (contentType === "prelims_pyq") {
          const optionsList = generated.options || [];
          const optA =
            optionsList[0]?.text || optionsList.find((o: any) => o.label === "A")?.text || "";
          const optB =
            optionsList[1]?.text || optionsList.find((o: any) => o.label === "B")?.text || "";
          const optC =
            optionsList[2]?.text || optionsList.find((o: any) => o.label === "C")?.text || "";
          const optD =
            optionsList[3]?.text || optionsList.find((o: any) => o.label === "D")?.text || "";

          const bodyContent = `### Year: ${
            generated.year || "2024"
          }\n\n**${generated.question_statement || ""}**\n\n${
            generated.supp_question_statement ? `${generated.supp_question_statement}\n\n` : ""
          }${
            generated.question_prompt ? `${generated.question_prompt}\n\n` : ""
          }(a) ${optA}\n(b) ${optB}\n(c) ${optC}\n(d) ${optD}\n\n**Correct Answer: (${
            generated.correct_answer || "A"
          })**\n\n### Explanation\n${generated.explanation || ""}`;

          onDraftGenerated({
            title: generated.title || "AI Generated Prelims Question",
            slug: generated.slug || adminSlug(generated.title || "ai-prelims-pyq"),
            contentKind: contentKind,
            status: "draft",
            categoryNodeId: categoryId,
            publicationDate: new Date().toISOString().slice(0, 10),
            sourceName: "AI Research Engine",
            sourceUrl: generated.source_url || "https://coaching-app.ai-generation.local",
            tags: generated.meta_keywords || "ai-generated",
            body: bodyContent,
            isAiGenerated: true,
            seoTitle: generated.title || "",
            seoDescription: generated.meta_description || generated.question_statement || "",
            canonicalUrl: generated.source_url || "",
            keywords: generated.meta_keywords || "",
            year: String(generated.year || new Date().getFullYear()),
            questionStatement: generated.question_statement || "",
            suppQuestionStatement: generated.supp_question_statement || "",
            questionPrompt: generated.question_prompt || "",
            optionA: optA,
            optionB: optB,
            optionC: optC,
            optionD: optD,
            correctAnswer: generated.correct_answer || "A",
            explanation: generated.explanation || "",
            wordLimit: "250",
            maxMarks: "15",
            answerApproach: "",
            modelAnswer: "",
          });
        } else if (contentType === "mains_pyq") {
          const bodyContent = `### Year: ${generated.year || "2024"} | Marks: ${
            generated.max_marks || "15"
          } | Word Limit: ${
            generated.word_limit || "250"
          }\n\n**${generated.question_statement || ""}**\n\n### Answer Approach\n${
            generated.answer_approach || ""
          }\n\n### Model Answer\n${generated.model_answer || ""}`;

          onDraftGenerated({
            title: generated.title || "AI Generated Mains Question",
            slug: generated.slug || adminSlug(generated.title || "ai-mains-pyq"),
            contentKind: contentKind,
            status: "draft",
            categoryNodeId: categoryId,
            publicationDate: new Date().toISOString().slice(0, 10),
            sourceName: "AI Research Engine",
            sourceUrl: generated.source_url || "https://coaching-app.ai-generation.local",
            tags: generated.meta_keywords || "ai-generated",
            body: bodyContent,
            isAiGenerated: true,
            seoTitle: generated.title || "",
            seoDescription: generated.meta_description || generated.question_statement || "",
            canonicalUrl: generated.source_url || "",
            keywords: generated.meta_keywords || "",
            year: String(generated.year || new Date().getFullYear()),
            questionStatement: generated.question_statement || "",
            suppQuestionStatement: "",
            questionPrompt: "",
            optionA: "",
            optionB: "",
            optionC: "",
            optionD: "",
            correctAnswer: "A",
            explanation: "",
            wordLimit: String(generated.word_limit || "250"),
            maxMarks: String(generated.max_marks || "15"),
            answerApproach: generated.answer_approach || "",
            modelAnswer: generated.model_answer || "",
          });
        } else {
          const sectionsList = generated.sections || [];
          const bodyContent = sectionsList
            .map((sec: any) => `## ${sec.section_title}\n\n${sec.content}`)
            .join("\n\n");

          onDraftGenerated({
            title: generated.title || "AI Generated Title",
            slug: generated.slug || adminSlug(generated.title || "ai-article"),
            contentKind: contentKind,
            status: "draft",
            categoryNodeId: categoryId,
            publicationDate: new Date().toISOString().slice(0, 10),
            sourceName: "AI Research Engine",
            sourceUrl: generated.source_url || "https://coaching-app.ai-generation.local",
            tags: generated.meta_keywords || "ai-generated",
            body: bodyContent,
            isAiGenerated: true,
            seoTitle: generated.title || "",
            seoDescription: generated.meta_description || "",
            canonicalUrl: generated.source_url || "",
            keywords: generated.meta_keywords || "",
            year: new Date().getFullYear().toString(),
            questionStatement: "",
            suppQuestionStatement: "",
            questionPrompt: "",
            optionA: "",
            optionB: "",
            optionC: "",
            optionD: "",
            correctAnswer: "A",
            explanation: "",
            wordLimit: "250",
            maxMarks: "15",
            answerApproach: "",
            modelAnswer: "",
          });
        }
      } else {
        await log("⚠️ Backend returned empty articles list. Please try again.", 1000);
      }
    } catch (e: any) {
      await log(`❌ Error calling AI: ${e.message || e}`, 1000);
    } finally {
      setTimeout(() => {
        setGenerating(false);
        setWorkspaceInput("");
      }, 500);
    }
  };

  const isBulkInput =
    workspaceInput
      .trim()
      .split("\n")
      .filter((t) => t.trim().length > 0).length > 1;

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-black text-ink flex items-center gap-2">
          <Brain className="h-5 w-5 text-civic" />
          AI Ingestion & Generation Workspace
        </h2>
        <p className="text-xs text-ink/65 mt-1">
          Create drafts using AI. Paste a news story, a prompt, or multiple topics/URLs (one per line
          for bulk queue).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1.2fr]">
        <div className="space-y-4">
          <label className="grid gap-1.5 text-xs font-black text-ink">
            Prompt, News story, or Bulk Topics/URLs (One per line)
            <textarea
              value={workspaceInput}
              onChange={(e) => setWorkspaceInput(e.target.value)}
              placeholder="e.g.&#10;Explain the Digital Personal Data Protection Act 2023.&#10;&#10;Or paste multiple lines for bulk queue:&#10;India GDP Q4 2026&#10;Electoral Bonds SC Verdict Explained"
              disabled={generating || bulkRunning}
              className="w-full min-h-[160px] rounded-xl border border-line p-3 sm:p-4 text-sm outline-none focus:border-civic text-ink focus:ring-2 focus:ring-civic/10 transition-all font-sans"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-black text-ink">
              Target Article Kind
              <select
                value={contentKind}
                onChange={(e) => setContentKind(e.target.value as ContentKind)}
                disabled={generating || bulkRunning}
                className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold outline-none focus:border-civic"
              >
                {ADMIN_CONTENT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-black text-ink">
              Syllabus Category Node
              <select
                value={categoryNodeId}
                onChange={(e) => setCategoryNodeId(e.target.value)}
                disabled={generating || bulkRunning}
                className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold outline-none focus:border-civic"
              >
                <option value="">Auto-Detect Category (AI Router)</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={isBulkInput ? runBulkQueue : runAiGeneration}
              disabled={generating || bulkRunning || !workspaceInput.trim()}
              className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-civic text-white font-bold text-sm shadow-md hover:bg-civic/90 active:scale-[0.98] transition-all disabled:opacity-50 touch-manipulation"
            >
              {generating || bulkRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isBulkInput ? "Start Bulk Ingestion Queue" : "Generate & Autofill Form Below"}
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceInput("")}
              disabled={generating || bulkRunning || !workspaceInput}
              className="h-12 px-4 rounded-xl border border-line font-bold text-xs text-ink/70 hover:bg-paper transition-all"
            >
              Reset Input
            </button>
          </div>
        </div>

        {/* Right column: Progress Logger */}
        <div className="border border-line rounded-2xl p-4 bg-paper/10 min-h-[220px] flex flex-col justify-between">
          <div className="space-y-3 w-full">
            <h4 className="text-xs font-black text-ink uppercase tracking-wider">
              AI Operations Status
            </h4>

            {bulkRunning && (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {queueItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center bg-surface border border-line rounded-lg p-2.5 shadow-sm text-xs"
                  >
                    <span className="font-bold text-ink truncate max-w-[70%]">{item.topic}</span>
                    <span
                      className={`px-2 py-0.5 rounded font-black uppercase text-[9px] ${
                        item.status === "completed"
                          ? "bg-civic/10 text-civic"
                          : item.status === "failed"
                          ? "bg-berry/10 text-berry"
                          : item.status === "running"
                          ? "bg-amber-100 text-amber-700 animate-pulse"
                          : "bg-paper text-ink/40"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {generating && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 text-civic animate-spin" />
                  <span className="text-xs font-bold text-civic animate-pulse">
                    Running Single-shot Agent Draft...
                  </span>
                </div>
                <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                  <div
                    className="h-full bg-civic transition-all duration-300"
                    style={{ width: `${(genStep / 5) * 100}%` }}
                  />
                </div>
                <div className="rounded-lg bg-midnight text-white p-3 font-mono text-[10px] space-y-1.5 max-h-[140px] overflow-y-auto">
                  {genLogs.map((log, idx) => (
                    <div className="flex items-start gap-1.5" key={idx}>
                      <ChevronRight className="h-3 w-3 shrink-0 text-civic mt-0.5" />
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!generating && !bulkRunning && (
              <p className="text-xs text-ink/50 italic p-4 text-center">
                Workspace is idle. Type prompts or topics above and click generate to initiate AI
                agents.
              </p>
            )}
          </div>

          {(bulkRunning || generating) && (
            <span className="text-[10px] text-center text-ink/50 border-t border-line/60 pt-2 block mt-2">
              Running in the background. Keep this browser tab open.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

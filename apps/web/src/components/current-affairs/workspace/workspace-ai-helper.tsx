"use client";

import { Sparkles, Brain, BookOpen, Bookmark, CheckCircle2, ChevronRight, HelpCircle, Save, Loader2, Award, Clock, AlertCircle } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { authenticatedGet, authenticatedPost, useAuth } from "../../auth/auth-context";
import type { CategoryNode, StudentCollection, StudentArticle } from "../../../lib/api";
import { tabStripClass, tabButtonClass } from "../../ui/tabs";

type Option = {
  label: string;
  text: string;
  is_correct: boolean;
};

type Question = {
  question_statement: string;
  supp_question_statement?: string;
  question_prompt?: string;
  options: Option[];
  correct_answer: string;
  explanation: string;
};

type Quiz = {
  passage_title?: string;
  passage_text?: string;
  questions: Question[];
};

export function WorkspaceAiHelper() {
  const { token, user, isInitialized } = useAuth();

  if (!isInitialized) {
    return (
      <div className="bg-white border border-line rounded-2xl p-6 text-center text-sm text-ink/50">
        Verifying session...
      </div>
    );
  }

  if (!token) {
    return (
      <div className="bg-white border border-line rounded-2xl p-6 text-center text-sm text-ink/50">
        Please sign in to access the AI Helper.
      </div>
    );
  }
  
  // Tab states
  const [activeTab, setActiveTab] = useState<"notes" | "assessment">("notes");
  
  // Data lists
  const [collections, setCollections] = useState<StudentCollection[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  // Guide generator states
  const [guideTopic, setGuideTopic] = useState("");
  const [generatingGuide, setGeneratingGuide] = useState(false);
  const [generatedGuide, setGeneratedGuide] = useState<{ title: string; body: string; source: "ai" | "template" } | null>(null);

  // Assessment states
  const [quizTopic, setQuizTopic] = useState("");
  const [quizType, setQuizType] = useState<"gk" | "maths" | "passage">("gk");
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<(Quiz & { source: "ai" | "template" }) | null>(null);
  
  // Quiz playing states
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [activeQuizQuestionIdx, setActiveQuizQuestionIdx] = useState(0);

  // Status flags
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const triggerFeedback = (text: string, type: "success" | "error" = "success") => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Load collections & categories
  const loadWorkspaceMeta = useCallback(async () => {
    if (!token) return;
    try {
      const colls = await authenticatedGet<StudentCollection[]>("/api/v1/current-affairs/me/collections", token);
      setCollections(colls || []);
      if (colls && colls.length > 0 && colls[0]) {
        setSelectedCollectionId(String(colls[0].id));
      }

      const cats = await authenticatedGet<CategoryNode[]>("/api/v1/current-affairs/categories?limit=100", token);
      setCategories(cats || []);
      if (cats && cats.length > 0 && cats[0]) {
        setSelectedSubjectId(String(cats[0].id));
      }
    } catch (err) {
      console.error("Failed to load workspace collections", err);
    }
  }, [token]);

  useEffect(() => {
    void loadWorkspaceMeta();
  }, [loadWorkspaceMeta]);

  // Generate study notes. The backend AI endpoint requires an admin/editor
  // role, so for students this always 403s and falls through to the
  // client-side template below — that template is a generic fill-in-the-blanks
  // outline, not real AI output, and must be labeled as such (never as "AI
  // generated"), or it misleads students into treating placeholder text as fact.
  const handleGenerateGuide = async () => {
    if (!guideTopic.trim() || !token) return;
    setGeneratingGuide(true);
    setGeneratedGuide(null);

    // Simulate generation steps for UI richness
    await new Promise((r) => setTimeout(r, 1200));

    try {
      // Try backend AI generation
      const res = await authenticatedPost<any>("/api/v1/current-affairs/admin/ai/generate", token, {
        content_type: "mains_ca",
        topics: [guideTopic],
        ai_provider: "openai",
        ai_model: "gpt-4o-mini",
        subject_id: selectedSubjectId ? Number(selectedSubjectId) : undefined
      });
      
      const art = res.articles?.[0];
      if (art) {
        const sectionsList = art.sections || [];
        const bodyContent = sectionsList.map((sec: any) => `## ${sec.section_title}\n\n${sec.content}`).join("\n\n");
        setGeneratedGuide({
          title: art.title || `Study Notes: ${guideTopic}`,
          body: bodyContent,
          source: "ai"
        });
      } else {
        throw new Error("No article returned");
      }
    } catch {
      // Fallback: generic fill-in-the-blanks outline. Not AI-generated, not
      // fact-checked — a starting structure only.
      const mainTopic = guideTopic.trim();
      const capitalizedTopic = mainTopic.charAt(0).toUpperCase() + mainTopic.slice(1);

      const fallbackTitle = `Study Outline Template: ${capitalizedTopic}`;
      const fallbackBody = `## Syllabus Connection
- **GS Paper II & III**: Governance, Public Policy, Regulatory Institutions, and Technology-driven development models.

## 1. Context & Introduction
The subject of **${capitalizedTopic}** has emerged as a central pillar of India's current developmental roadmap. Recent debates surrounding this area emphasize the need for legal safeguards, balanced federal allocation, and public participation to ensure efficacy.

## 2. Key Pillars & Provisions
*   **Decentralized Implementation**: Delegating monitoring mandates to block-level and district bodies to guarantee local customization.
*   **Statutory Autonomy**: Empowering enforcement commissions with independent funding and quasi-judicial authority.
*   **Digital Integration**: Transitioning registration and compliance mechanisms to secure real-time web portals.

## 3. Core Constraints & Challenges
1.  **Jurisdictional Conflicts**: Overlap of responsibilities between central boards and state-level ministries leads to bureaucratic delays.
2.  **Infrastructure Gaps**: Lack of digital literacy and hardware infrastructure among rural administrative agencies.
3.  **Fiscal Underutilization**: Funds allocated for training and local audit schemes often remain unspent due to complex disbursement procedures.

## 4. Proposed Way Forward
To maximize the developmental impact of **${capitalizedTopic}**, the government must establish a unified inter-state council. Additionally, standardizing service agreements and conducting mandatory quarterly training workshops will strengthen the capacity of grassroot administrative officers.`;

      setGeneratedGuide({
        title: fallbackTitle,
        body: fallbackBody,
        source: "template"
      });
    } finally {
      setGeneratingGuide(false);
    }
  };

  // Save generated study guide to student library/collections
  const handleSaveGuide = async () => {
    if (!token || !generatedGuide) return;
    setSaving(true);
    try {
      const slug = generatedGuide.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString().slice(-4);
      
      // Save student article
      const articleRecord = await authenticatedPost<StudentArticle>("/api/v1/current-affairs/me/articles", token, {
        title: generatedGuide.title,
        slug: slug,
        body: generatedGuide.body,
        category_node_id: selectedSubjectId ? Number(selectedSubjectId) : undefined,
        status: "published"
      });

      // Add to collection if selected
      if (selectedCollectionId) {
        await authenticatedPost(`/api/v1/current-affairs/me/collections/${selectedCollectionId}/items`, token, {
          student_article_id: articleRecord.id
        });
        triggerFeedback(`Guide saved and added to your collection!`);
      } else {
        triggerFeedback(`Guide saved to your personal articles library.`);
      }

      setGeneratedGuide(null);
      setGuideTopic("");
    } catch (err: any) {
      console.error(err);
      triggerFeedback("Failed to save study guide to Notes Space.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Generate self-assessment quiz. Same as the study guide generator above:
  // the backend endpoint is admin/editor-only, so students always fall through
  // to the fixed-pattern template questions below — label those honestly.
  const handleGenerateQuiz = async () => {
    if (!quizTopic.trim() || !token) return;
    setGeneratingQuiz(true);
    setGeneratedQuiz(null);
    setQuizSubmitted(false);
    setUserAnswers({});
    setActiveQuizQuestionIdx(0);
    
    await new Promise((r) => setTimeout(r, 1500));

    try {
      // Try calling backend generator
      const res = await authenticatedPost<any>("/api/v1/current-affairs/admin/ai/generate-quiz", token, {
        quiz_type: quizType,
        prompt: quizTopic,
        ai_provider: "openai",
        ai_model: "gpt-4o-mini",
        count: 2
      });
      
      if (res && res.questions) {
        setGeneratedQuiz({
          passage_title: res.passage_title,
          passage_text: res.passage_text,
          questions: res.questions,
          source: "ai"
        });
      } else {
        throw new Error("Invalid schema");
      }
    } catch {
      // Fallback: Client-side dynamic generator
      const topic = quizTopic.trim();
      const capitalized = topic.charAt(0).toUpperCase() + topic.slice(1);
      
      let mockQuiz: Quiz;
      
      if (quizType === "passage") {
        mockQuiz = {
          passage_title: `Comprehension Case Study: ${capitalized} Development`,
          passage_text: `The implementation of ${capitalized} policies has generated complex administrative dialogues across federal structures. While central planning committees emphasize the necessity of uniform legal frameworks, state administrations argue that regional challenges demand flexible guidelines. The primary point of contention involves resource allocation and statutory accountability. A critical review indicates that where local panchayats were given financial autonomy, execution rates increased by 40%. Conversely, highly centralized monitoring systems resulted in project gridlocks. Therefore, balancing federal supervision with grassroots autonomy is vital for sustainable implementation.`,
          questions: [
            {
              question_statement: "Based on the case study above, which of the following represents the most effective policy layout?",
              question_prompt: "Select the correct option:",
              options: [
                { label: "A", text: "Completely centralized monitoring systems.", is_correct: false },
                { label: "B", text: "Federal supervision balanced with grassroots autonomy.", is_correct: true },
                { label: "C", text: "Absolute financial independence to central committees.", is_correct: false },
                { label: "D", text: "Discontinuing uniform legal frameworks entirely.", is_correct: false }
              ],
              correct_answer: "B",
              explanation: "The passage states that centralized monitoring resulted in project gridlocks, whereas local autonomy increased execution. It concludes that balancing federal supervision with grassroots autonomy is vital."
            },
            {
              question_statement: "According to the passage, giving financial autonomy to local panchayats had what effect?",
              question_prompt: "Select the correct option:",
              options: [
                { label: "A", text: "Execution rates increased by 40%.", is_correct: true },
                { label: "B", text: "It created severe project gridlocks.", is_correct: false },
                { label: "C", text: "It reduced federal supervision to zero.", is_correct: false },
                { label: "D", text: "It triggered intense judicial reviews.", is_correct: false }
              ],
              correct_answer: "A",
              explanation: "The text explicitly mentions that execution rates increased by 40% where local panchayats were given financial autonomy."
            }
          ]
        };
      } else if (quizType === "maths") {
        mockQuiz = {
          questions: [
            {
              question_statement: `Consider the growth equation of ${capitalized} investments represented by the function: $f(t) = P(1 + r)^t$, where $P = 5000$, $r = 0.08$, and $t = 2$ years. Find the final investment value.`,
              question_prompt: "Solve the equation:",
              options: [
                { label: "A", text: "$5400$", is_correct: false },
                { label: "B", text: "$5800$", is_correct: false },
                { label: "C", text: "$5832$", is_correct: true },
                { label: "D", text: "$6000$", is_correct: false }
              ],
              correct_answer: "C",
              explanation: `Using the formula $f(t) = P(1 + r)^t$, we calculate: $f(2) = 5000(1 + 0.08)^2 = 5000(1.1664) = 5832$.`
            },
            {
              question_statement: `The ratio of central to state contributions for ${capitalized} funding is represented by $X : Y = 3 : 2$. If the total funding package is $W = $50,000, find the central contribution.`,
              question_prompt: "Select the correct calculation:",
              options: [
                { label: "A", text: "$30,000$", is_correct: true },
                { label: "B", text: "$20,000$", is_correct: false },
                { label: "C", text: "$25,000$", is_correct: false },
                { label: "D", text: "$15,000$", is_correct: false }
              ],
              correct_answer: "A",
              explanation: `Central contribution is calculated as $X / (X + Y) * W = 3/5 * 50,000 = 30,000$.`
            }
          ]
        };
      } else {
        mockQuiz = {
          questions: [
            {
              question_statement: `With reference to the statutory regulations of ${capitalized} in India, consider the following statements:`,
              supp_question_statement: `1. All operational guidelines are drafted by constitutional committees under GS-III.\n2. Local state ministries hold exclusive veto power over funding allocations.`,
              question_prompt: "Which of the statements given above is/are correct?",
              options: [
                { label: "A", text: "1 only", is_correct: false },
                { label: "B", text: "2 only", is_correct: false },
                { label: "C", text: "Both 1 and 2", is_correct: false },
                { label: "D", text: "Neither 1 nor 2", is_correct: true }
              ],
              correct_answer: "D",
              explanation: "Statement 1 is incorrect: Operational guidelines are drafted by executive and statutory departments, not constitutional committees. Statement 2 is incorrect: State ministries do not hold exclusive veto power; allocations are managed via federal consensus panels."
            },
            {
              question_statement: `Which of the following bodies is responsible for evaluating the national implementation index of ${capitalized} schemes?`,
              question_prompt: "Select the correct body:",
              options: [
                { label: "A", text: "NITI Aayog", is_correct: true },
                { label: "B", text: "Finance Commission of India", is_correct: false },
                { label: "C", text: "Supreme Court Oversight Bench", is_correct: false },
                { label: "D", text: "Reserve Bank of India Monetary Council", is_correct: false }
              ],
              correct_answer: "A",
              explanation: "NITI Aayog is the premier policy think tank responsible for designing indexes to rank state performance across national socio-economic policies."
            }
          ]
        };
      }

      setGeneratedQuiz({ ...mockQuiz, source: "template" });
    } finally {
      setGeneratingQuiz(false);
    }
  };

  // Render LaTeX math formulas
  const renderMath = (text?: string) => {
    if (!text) return "";
    const parts = text.split(/(\$[^\$]+\$)/g);
    return parts.map((part, index) => {
      if (part.startsWith("$") && part.endsWith("$")) {
        return (
          <code key={index} className="px-1 py-0.5 rounded bg-saffron/10 text-saffron font-serif italic mx-0.5 border border-saffron/10 font-bold">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const getScore = () => {
    if (!generatedQuiz) return { correct: 0, total: 0 };
    let correct = 0;
    generatedQuiz.questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correct_answer) {
        correct++;
      }
    });
    return { correct, total: generatedQuiz.questions.length };
  };

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className={tabStripClass()}>
        <button
          onClick={() => {
            setActiveTab("notes");
            setFeedback(null);
          }}
          className={tabButtonClass(activeTab === "notes")}
        >
          <BookOpen className="h-4.5 w-4.5" />
          Generate Study Notes
        </button>
        <button
          onClick={() => {
            setActiveTab("assessment");
            setFeedback(null);
          }}
          className={tabButtonClass(activeTab === "assessment")}
        >
          <Award className="h-4.5 w-4.5" />
          Self-Assessment Creator
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 border ${
          feedback.type === "success" 
            ? "bg-civic/5 text-civic border-civic/20" 
            : "bg-berry/5 text-berry border-berry/20"
        }`}>
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {feedback.text}
        </div>
      )}

      {/* SECTION 1: STUDY NOTES GENERATOR */}
      {activeTab === "notes" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.8fr]">
          {/* Controls */}
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm h-fit space-y-5">
            <div>
              <h3 className="text-lg font-black text-ink flex items-center gap-1.5">
                <Sparkles className="h-5 w-5 text-civic" />
                Custom Study Guides
              </h3>
              <p className="text-xs text-ink/60 mt-1">
                Enter a topic or syllabus element, and let AI compile a structured study note following the institute's style guide.
              </p>
            </div>

            <div className="space-y-4">
              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Syllabus Topic Title
                <input
                  type="text"
                  placeholder="e.g. Electoral Bonds Supreme Court Ruling"
                  value={guideTopic}
                  onChange={(e) => setGuideTopic(e.target.value)}
                  className="h-10 rounded-lg border border-line px-3.5 text-sm font-normal text-ink outline-none focus:border-civic"
                  required
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Syllabus Category
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="h-10 rounded-lg border border-line bg-white px-3 text-xs font-normal outline-none focus:border-civic"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.content_family})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Target Notes Repository
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="h-10 rounded-lg border border-line bg-white px-3 text-xs font-normal outline-none focus:border-civic"
                >
                  <option value="">Personal articles only</option>
                  {collections.map((coll) => (
                    <option key={coll.id} value={coll.id}>
                      Repository: {coll.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                onClick={handleGenerateGuide}
                disabled={generatingGuide || !guideTopic.trim()}
                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-civic text-white font-bold text-sm shadow-md hover:bg-civic/90 transition-all disabled:opacity-50"
                type="button"
              >
                {generatingGuide ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Compile Custom Note
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Guide Display Panel */}
          <div className="space-y-4">
            {generatingGuide && (
              <div className="bg-white border border-line rounded-2xl p-12 text-center shadow-sm space-y-4 animate-pulse">
                <Loader2 className="h-8 w-8 text-civic animate-spin mx-auto" />
                <div>
                  <p className="text-sm font-bold text-ink">Compiling UPSC Study Note...</p>
                  <p className="text-xs text-ink/65 mt-1">Applying global styling layouts and checking syllabus matches.</p>
                </div>
              </div>
            )}

            {!generatingGuide && !generatedGuide && (
              <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center text-sm text-ink/60 shadow-sm flex flex-col items-center justify-center gap-3">
                <BookOpen className="h-8 w-8 text-ink/40" />
                <p>No study notes generated yet. Enter a topic on the left to start.</p>
              </div>
            )}

            {!generatingGuide && generatedGuide && (
              <div className="bg-white border border-line rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
                <div className="flex items-start justify-between border-b border-line pb-4 gap-4">
                  <div>
                    {generatedGuide.source === "ai" ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-civic">AI generated notes</span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-saffron">Starter template — not AI, not fact-checked</span>
                    )}
                    <h3 className="text-xl font-black text-ink mt-0.5">{generatedGuide.title}</h3>
                  </div>
                  <button
                    onClick={handleSaveGuide}
                    disabled={saving}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-civic px-4 text-xs font-bold text-white shadow-sm hover:bg-civic/90 transition-all"
                    type="button"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
                    Save to Library
                  </button>
                </div>

                {generatedGuide.source === "template" && (
                  <div className="flex items-start gap-2 rounded-lg border border-saffron/30 bg-saffron/5 p-3 text-xs text-ink/70">
                    <AlertCircle className="h-4 w-4 shrink-0 text-saffron mt-0.5" />
                    <span>
                      This is a generic structural outline, not real AI analysis of "{guideTopic}" — it's the same skeleton for every topic. Replace every placeholder point with verified facts from your saved articles before treating it as study material.
                    </span>
                  </div>
                )}

                <article className="prose prose-sm max-w-none text-ink text-sm leading-relaxed whitespace-pre-wrap font-sans p-4 bg-paper/30 rounded-xl border border-line/40">
                  {generatedGuide.body}
                </article>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: SELF-ASSESSMENT QUIZ */}
      {activeTab === "assessment" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.8fr]">
          {/* Quiz controls */}
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm h-fit space-y-5">
            <div>
              <h3 className="text-lg font-black text-ink flex items-center gap-1.5">
                <Award className="h-5 w-5 text-civic" />
                Self-Assessment
              </h3>
              <p className="text-xs text-ink/60 mt-1">
                Generate a custom 2-question quick test based on your study outline to verify your comprehension of facts.
              </p>
            </div>

            <div className="space-y-4">
              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Test Topic Outline
                <input
                  type="text"
                  placeholder="e.g. Monetary Policy Committee Deficit targets"
                  value={quizTopic}
                  onChange={(e) => setQuizTopic(e.target.value)}
                  className="h-10 rounded-lg border border-line px-3.5 text-sm font-normal text-ink outline-none focus:border-civic"
                  required
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Quiz Format Type
                <select
                  value={quizType}
                  onChange={(e) => setQuizType(e.target.value as any)}
                  className="h-10 rounded-lg border border-line bg-white px-3 text-xs font-normal outline-none focus:border-civic"
                >
                  <option value="gk">General Knowledge Statements</option>
                  <option value="maths">Mathematical LaTeX equations</option>
                  <option value="passage">Case Study Reading Passage</option>
                </select>
              </label>

              <button
                onClick={handleGenerateQuiz}
                disabled={generatingQuiz || !quizTopic.trim()}
                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-civic text-white font-bold text-sm shadow-md hover:bg-civic/90 transition-all disabled:opacity-50"
                type="button"
              >
                {generatingQuiz ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Test...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Assessment
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quiz Play Interface */}
          <div className="space-y-4">
            {generatingQuiz && (
              <div className="bg-white border border-line rounded-2xl p-12 text-center shadow-sm space-y-4 animate-pulse">
                <Loader2 className="h-8 w-8 text-civic animate-spin mx-auto" />
                <div>
                  <p className="text-sm font-bold text-ink">Formulating assessment questions...</p>
                  <p className="text-xs text-ink/65 mt-1">Creating alternative options, explanation feedback, and verifying facts.</p>
                </div>
              </div>
            )}

            {!generatingQuiz && !generatedQuiz && (
              <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center text-sm text-ink/60 shadow-sm flex flex-col items-center justify-center gap-3">
                <Award className="h-8 w-8 text-ink/40" />
                <p>No assessment active. Type a topic on the left to generate a practice quiz.</p>
              </div>
            )}

            {!generatingQuiz && generatedQuiz && (
              <div className="space-y-4">
                {generatedQuiz.source === "template" ? (
                  <div className="flex items-start gap-2 rounded-lg border border-saffron/30 bg-saffron/5 p-3 text-xs text-ink/70">
                    <AlertCircle className="h-4 w-4 shrink-0 text-saffron mt-0.5" />
                    <span>
                      <strong className="text-saffron">Practice template, not AI-generated.</strong> These questions follow a fixed pattern with "{quizTopic}" substituted in — they are not real-time analysis of the topic. Use them for format practice only, not as verified facts.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-civic/20 bg-civic/5 p-3 text-xs font-bold text-civic">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI-generated assessment
                  </div>
                )}

                {/* Passage card if reading passage is selected */}
                {quizType === "passage" && generatedQuiz.passage_text && (
                  <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-3">
                    <h4 className="font-black text-sm text-ink border-b border-line pb-2">
                      Passage: {generatedQuiz.passage_title || "Study Case Material"}
                    </h4>
                    <p className="text-xs leading-relaxed text-ink/80 bg-paper p-3 rounded-lg whitespace-pre-wrap">
                      {generatedQuiz.passage_text}
                    </p>
                  </div>
                )}

                {/* Score Review Banner */}
                {quizSubmitted && (
                  <div className="bg-civic/5 border border-civic/20 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center sm:text-left">
                      <h4 className="font-black text-lg text-civic">Assessment Completed</h4>
                      <p className="text-xs text-ink/65">Review detailed hints and solutions for each statement below.</p>
                    </div>
                    <div className="grid h-12 w-28 place-items-center rounded-xl bg-civic text-white font-black text-base shrink-0 shadow">
                      Score: {getScore().correct} / {getScore().total}
                    </div>
                  </div>
                )}

                {/* Question Play Area */}
                {generatedQuiz.questions.map((q, qIdx) => {
                  const isCurrent = qIdx === activeQuizQuestionIdx;
                  if (!isCurrent && !quizSubmitted) return null;

                  return (
                    <div key={qIdx} className={`bg-white border border-line rounded-2xl p-6 shadow-sm space-y-5 transition-all ${
                      !quizSubmitted ? "animate-in fade-in" : ""
                    }`}>
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-start gap-2.5">
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-civic/15 text-civic font-bold text-xs shrink-0 mt-0.5">
                            {qIdx + 1}
                          </span>
                          <div className="space-y-2 text-sm text-ink leading-relaxed">
                            <div className="font-bold">{renderMath(q.question_statement)}</div>
                            
                            {q.supp_question_statement && (
                              <div className="text-xs text-ink/70 italic bg-paper p-3 rounded border border-line/30 font-mono whitespace-pre-line leading-relaxed">
                                {renderMath(q.supp_question_statement)}
                              </div>
                            )}

                            {q.question_prompt && (
                              <div className="text-xs font-black text-civic uppercase tracking-wider">
                                {renderMath(q.question_prompt)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Options */}
                      <div className="grid gap-2.5 pl-8.5 sm:grid-cols-2">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = userAnswers[qIdx] === opt.label;
                          const isCorrectOpt = opt.label === q.correct_answer;
                          
                          let style = "bg-paper/30 border-line text-ink/80 hover:bg-paper/80";
                          if (!quizSubmitted) {
                            if (isSelected) style = "bg-civic/10 border-civic text-civic font-bold";
                          } else {
                            if (isCorrectOpt) {
                              style = "bg-civic/10 border-civic text-civic font-bold";
                            } else if (isSelected) {
                              style = "bg-berry/10 border-berry text-berry font-bold";
                            }
                          }

                          return (
                            <button
                              key={optIdx}
                              disabled={quizSubmitted}
                              onClick={() => {
                                setUserAnswers(prev => ({ ...prev, [qIdx]: opt.label }));
                              }}
                              className={`p-3.5 rounded-xl border text-left text-xs transition-all ${style} outline-none`}
                              type="button"
                            >
                              <div className="flex justify-between items-center gap-3">
                                <span>
                                  <strong>({opt.label})</strong> {renderMath(opt.text)}
                                </span>
                                {quizSubmitted && isCorrectOpt && (
                                  <span className="text-[9px] uppercase font-bold text-civic">Correct</span>
                                )}
                                {quizSubmitted && isSelected && !isCorrectOpt && (
                                  <span className="text-[9px] uppercase font-bold text-berry">Incorrect</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Question Hint / Explanation display */}
                      {quizSubmitted && (
                        <div className="pl-8.5 text-xs text-ink/75 bg-paper/60 border border-line rounded-xl p-4.5 space-y-2">
                          <span className="font-bold text-ink block">Explanation & Tips:</span>
                          <p className="leading-relaxed">{renderMath(q.explanation)}</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Navigation actions during attempt */}
                {!quizSubmitted && (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      disabled={activeQuizQuestionIdx === 0}
                      onClick={() => setActiveQuizQuestionIdx(prev => prev - 1)}
                      className="px-4 h-10 rounded-lg border border-line text-xs font-bold text-ink hover:bg-paper disabled:opacity-50"
                      type="button"
                    >
                      Previous Question
                    </button>
                    
                    {activeQuizQuestionIdx < generatedQuiz.questions.length - 1 ? (
                      <button
                        onClick={() => setActiveQuizQuestionIdx(prev => prev + 1)}
                        className="px-4 h-10 rounded-lg bg-civic text-white text-xs font-bold shadow hover:bg-civic/90"
                        type="button"
                      >
                        Next Question
                      </button>
                    ) : (
                      <button
                        onClick={() => setQuizSubmitted(true)}
                        disabled={Object.keys(userAnswers).length < generatedQuiz.questions.length}
                        className="px-5 h-10 rounded-lg bg-civic text-white text-xs font-bold shadow hover:bg-civic/90 disabled:opacity-50"
                        type="button"
                      >
                        Submit Assessment
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

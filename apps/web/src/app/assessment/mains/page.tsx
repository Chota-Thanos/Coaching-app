"use client";

import { FileEdit, Search, Award, BookOpen, Clock, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authenticatedGet, useAuth } from "../../../components/auth/auth-context";

type MainsQuestion = {
  id: number;
  question_family: string;
  status: string;
  created_at: string;
  current_version: {
    id: number;
    question_statement: string;
    supplementary_statement?: string;
    question_prompt?: string;
  };
  mains_details: {
    word_limit?: number;
    marks: string;
    directive?: string;
  };
  taxonomy_links?: Array<{
    paper_node_id?: number;
  }>;
};

export default function StudentMainsPage() {
  const { token, isInitialized } = useAuth();
  const [questions, setQuestions] = useState<MainsQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [paperFilter, setPaperFilter] = useState("all");

  useEffect(() => {
    const loadQuestions = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await authenticatedGet<MainsQuestion[]>("/api/v1/assessment/mains/questions?status=published&limit=100", token);
        setQuestions(data || []);
      } catch (err) {
        console.error("Failed to load subjective questions", err);
      } finally {
        setLoading(false);
      }
    };
    if (isInitialized) {
      void loadQuestions();
    }
  }, [token, isInitialized]);

  const filteredQuestions = questions.filter((q) => {
    const text = (q.current_version?.question_statement || "").toLowerCase();
    const matchesSearch = text.includes(searchTerm.toLowerCase());
    
    // Simple mock classification for GS papers if nodes are not set up
    const textLower = text.toLowerCase();
    let computedPaper = "gs1";
    if (textLower.includes("governance") || textLower.includes("polity") || textLower.includes("constitution") || textLower.includes("federal")) {
      computedPaper = "gs2";
    } else if (textLower.includes("economy") || textLower.includes("tech") || textLower.includes("environment") || textLower.includes("agriculture") || textLower.includes("hydrogen")) {
      computedPaper = "gs3";
    } else if (textLower.includes("ethics") || textLower.includes("integrity") || textLower.includes("attitude")) {
      computedPaper = "gs4";
    }
    
    const matchesPaper = paperFilter === "all" || computedPaper === paperFilter;
    return matchesSearch && matchesPaper;
  });

  return (
    <main className="list-page mx-auto max-w-5xl px-4 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="space-y-2 border-b border-line pb-4">
        <span className="text-xs font-bold text-civic uppercase tracking-wider">UPSC Mains Writing Console</span>
        <h1 className="text-3xl font-black text-ink">Subjective Practice Portal</h1>
        <p className="text-sm text-ink/65">
          Write essays and answering sheets, submit, and get instant grading feedback aligned to UPSC standards.
        </p>
      </div>

      {/* Filter panel */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
          <input
            type="text"
            placeholder="Search mains questions by topic keywords..."
            className="w-full h-11 rounded-xl border border-line pl-10 pr-4 text-sm outline-none focus:border-civic"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="h-11 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-ink outline-none focus:border-civic"
          value={paperFilter}
          onChange={(e) => setPaperFilter(e.target.value)}
        >
          <option value="all">All GS Papers</option>
          <option value="gs1">GS Paper 1 (History, Geography, Society)</option>
          <option value="gs2">GS Paper 2 (Polity, Governance, IR)</option>
          <option value="gs3">GS Paper 3 (Economy, Env, S&T)</option>
          <option value="gs4">GS Paper 4 (Ethics, Case Studies)</option>
        </select>
      </div>

      {/* Questions list */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-8 w-8 text-civic animate-spin" />
          <span className="text-sm font-semibold text-ink/60">Loading Mains practice bank...</span>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-line rounded-2xl bg-surface">
          <BookOpen className="h-10 w-10 text-ink/30 mx-auto mb-2" />
          <p className="text-sm font-bold text-ink/70">No Mains questions available</p>
          <p className="text-xs text-ink/50 mt-1">Check back later for updated subjective question sets.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredQuestions.map((q) => {
            // Determine paper badge label
            const textLower = q.current_version.question_statement.toLowerCase();
            let paperBadge = "GS Paper 1";
            let paperColor = "text-indigo-600 bg-indigo-50 border-indigo-150";
            if (textLower.includes("governance") || textLower.includes("polity") || textLower.includes("constitution") || textLower.includes("federal")) {
              paperBadge = "GS Paper 2";
              paperColor = "text-emerald-600 bg-emerald-50 border-emerald-150";
            } else if (textLower.includes("economy") || textLower.includes("tech") || textLower.includes("environment") || textLower.includes("agriculture") || textLower.includes("hydrogen")) {
              paperBadge = "GS Paper 3";
              paperColor = "text-amber-600 bg-amber-50 border-amber-150";
            } else if (textLower.includes("ethics") || textLower.includes("integrity") || textLower.includes("attitude")) {
              paperBadge = "GS Paper 4";
              paperColor = "text-rose-600 bg-rose-50 border-rose-150";
            }

            return (
              <article
                key={q.id}
                className="bg-surface border border-line rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between gap-5 relative overflow-hidden"
              >
                <div className="space-y-4 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${paperColor}`}>
                      {paperBadge}
                    </span>
                    
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-ink/50">
                      <Award className="h-4.5 w-4.5 text-civic" />
                      {q.mains_details?.marks || "10"} Marks
                    </span>

                    {q.mains_details?.word_limit && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-ink/50 border-l border-line pl-3">
                        <Clock className="h-4 w-4" />
                        {q.mains_details.word_limit} Words
                      </span>
                    )}

                    {q.mains_details?.directive && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-ink/50 border-l border-line pl-3 uppercase tracking-wider">
                        {q.mains_details.directive}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-ink leading-snug line-clamp-3">
                    {q.current_version.question_statement}
                  </h3>

                  {q.current_version.supplementary_statement && (
                    <p className="text-xs text-ink/60 bg-paper/40 p-3 rounded-lg leading-relaxed">
                      {q.current_version.supplementary_statement}
                    </p>
                  )}

                  {q.current_version.question_prompt && (
                    <p className="text-xs font-bold text-indigo-900 bg-indigo-50/20 p-2.5 rounded-lg border border-indigo-100 leading-relaxed">
                      {q.current_version.question_prompt}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center md:border-l md:border-line md:pl-5">
                  <Link
                    href={`/assessment/mains/${q.id}`}
                    className="w-full md:w-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-civic px-5 text-sm font-bold text-white shadow-sm hover:bg-civic/90 active:scale-[0.98] transition-all"
                  >
                    <FileEdit className="h-4 w-4" />
                    Practice Answer
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

"use client";

import { Brain, Sparkles, BookOpen, Save, Plus, Trash2, CheckCircle2, Loader2, AlertCircle, Newspaper, FileText, ArrowRight } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { authenticatedGet, authenticatedPost, authenticatedDelete, useAuth } from "../../auth/auth-context";
import type { CategoryNode } from "../../../lib/api";
import { tabStripClass, tabButtonClass } from "../../ui/tabs";

type StyleGuideState = {
  id?: number;
  style_guide: string;
  source_text: string;
};

type AiInstruction = {
  id: number;
  scope: "general" | "article" | "premium" | "subject" | "quiz";
  title: string;
  content_type?: string;
  subject_node_id?: number;
  prompt: string;
  is_active: boolean;
};

const ARTICLE_KINDS = [
  { value: "", label: "-- Global Default Style --" },
  { value: "daily_current_affairs", label: "Daily Current Affairs" },
  { value: "daily_editorial_summary", label: "Daily Editorial Summary" },
  { value: "mains_topic_note", label: "Mains Topic Note" },
  { value: "mains_summary", label: "Mains Summary" },
  { value: "mains_article", label: "Mains Article" },
  { value: "study_note", label: "Study Note" },
  { value: "prelims_pyq", label: "Prelims PYQ" },
  { value: "mains_pyq", label: "Mains PYQ" }
];

const QUIZ_TYPES = [
  { value: "", label: "-- Global Default Style --" },
  { value: "gk", label: "General Knowledge (GK)" },
  { value: "maths", label: "Mathematics / LaTeX" },
  { value: "passage", label: "Reading Passage Link" },
  { value: "quick_test", label: "Quick Test" },
  { value: "sectional_test", label: "Sectional Test" },
  { value: "full_length_test", label: "Full Length Test" },
  { value: "pyq_test", label: "PYQ Test" },
  { value: "mains_test", label: "Mains subjective test" }
];

export function AiSettingsManager() {
  const { token } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<"articles" | "quizzes" | "subject-prompts">("articles");
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  
  // Selection states
  const [selectedArticleKind, setSelectedArticleKind] = useState<string>("");
  const [selectedQuizType, setSelectedQuizType] = useState<string>("");

  // Editor States
  const [styleGuide, setStyleGuide] = useState<StyleGuideState>({ style_guide: "", source_text: "" });
  const [promptValue, setPromptValue] = useState<string>("");
  const [instructions, setInstructions] = useState<AiInstruction[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Subject Override states
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [overridePrompt, setOverridePrompt] = useState<string>("");
  const [overrideTitle, setOverrideTitle] = useState<string>("");
  const [subjectSampleText, setSubjectSampleText] = useState<string>("");
  const [generatingStyle, setGeneratingStyle] = useState<boolean>(false);

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Load style guide for selection
  const loadStyleAndPrompt = useCallback(async (isQuiz: boolean, type: string) => {
    if (!token) return;
    try {
      // 1. Fetch style guide
      const guide = await authenticatedGet<StyleGuideState>(
        `/api/v1/current-affairs/admin/ai/style-guide?content_type=${type}`,
        token
      );
      setStyleGuide(guide || { style_guide: "", source_text: "" });

      // 2. Fetch all instructions and find matching
      const allInsts = await authenticatedGet<AiInstruction[]>("/api/v1/current-affairs/admin/ai/instructions", token);
      setInstructions(allInsts || []);
      
      const match = allInsts?.find(
        i => i.scope === (isQuiz ? "quiz" : "article") && (i.content_type === type || (!i.content_type && !type))
      );
      setPromptValue(match ? match.prompt : "");
    } catch (err) {
      console.error("Error loading style & prompt details:", err);
      showMessage("Failed to load details for selection", "error");
    }
  }, [token]);

  // Load initial catalog
  const loadInitialCatalog = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const cats = await authenticatedGet<CategoryNode[]>("/api/v1/current-affairs/categories?limit=200", token);
      setCategories(cats);
      await loadStyleAndPrompt(false, ""); // Load global default article style first
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, loadStyleAndPrompt]);

  useEffect(() => {
    void loadInitialCatalog();
  }, [loadInitialCatalog]);

  // Trigger loading when dropdown selection or tab changes
  useEffect(() => {
    if (activeSubTab === "articles") {
      void loadStyleAndPrompt(false, selectedArticleKind);
    } else if (activeSubTab === "quizzes") {
      void loadStyleAndPrompt(true, selectedQuizType);
    }
  }, [activeSubTab, selectedArticleKind, selectedQuizType, loadStyleAndPrompt]);

  // Handle saving Style Guide & Prompt
  const handleSaveStyleAndPrompt = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const isQuiz = activeSubTab === "quizzes";
      const contentType = isQuiz ? selectedQuizType : selectedArticleKind;

      // 1. Save style guide
      await authenticatedPost("/api/v1/current-affairs/admin/ai/style-guide", token, {
        style_guide: styleGuide.style_guide,
        source_text: styleGuide.source_text || null,
        content_type: contentType || null
      });

      // 2. Save prompt
      await authenticatedPost("/api/v1/current-affairs/admin/ai/instructions", token, {
        scope: isQuiz ? "quiz" : "article",
        title: `${contentType || "Global Default"} settings prompt`,
        content_type: contentType || null,
        prompt: promptValue,
        is_active: true
      });

      showMessage("Styles and generation prompts updated successfully!");
      // Reload matching values
      await loadStyleAndPrompt(isQuiz, contentType);
    } catch (err) {
      showMessage("Failed to save style configurations", "error");
    } finally {
      setSaving(false);
    }
  };

  // Analyze writing style references
  const handleAnalyzeStyle = async () => {
    if (!token) return;
    if (!styleGuide.source_text?.trim()) {
      showMessage("Please paste some reference text to analyze", "error");
      return;
    }
    
    setSaving(true);
    try {
      const res = await authenticatedPost<{ style_guide: string }>(
        "/api/v1/current-affairs/admin/ai/extract-style",
        token,
        { source_text: styleGuide.source_text }
      );
      
      if (res && res.style_guide) {
        setStyleGuide(prev => ({
          ...prev,
          style_guide: res.style_guide
        }));
        showMessage("Reference text analyzed! Extracted guidelines loaded into editor.");
      } else {
        throw new Error("No style guidelines returned from AI.");
      }
    } catch (err: any) {
      console.error("Error analyzing style:", err);
      showMessage("Failed to analyze style: " + (err.message || err), "error");
    } finally {
      setSaving(false);
    }
  };

  // Save subject prompt override
  const handleSaveSubjectPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedSubjectId || !overridePrompt.trim() || !overrideTitle.trim()) {
      showMessage("All subject override fields are required", "error");
      return;
    }

    setSaving(true);
    try {
      const subjectNodeId = Number(selectedSubjectId);
      const subject = categories.find(c => c.id === subjectNodeId);
      
      await authenticatedPost("/api/v1/current-affairs/admin/ai/instructions", token, {
        scope: "subject",
        title: overrideTitle,
        subject_node_id: subjectNodeId,
        prompt: overridePrompt,
        is_active: true
      });

      setOverridePrompt("");
      setOverrideTitle("");
      setSelectedSubjectId("");
      setSubjectSampleText("");
      
      const allInsts = await authenticatedGet<AiInstruction[]>("/api/v1/current-affairs/admin/ai/instructions", token);
      setInstructions(allInsts || []);
      
      showMessage(`Instruction override for '${subject?.name}' saved!`);
    } catch (err) {
      showMessage("Failed to save subject override prompt", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSubjectStylePrompt = async () => {
    if (!token) return;
    if (!subjectSampleText.trim()) {
      showMessage("Please paste some reference text to analyze", "error");
      return;
    }

    setGeneratingStyle(true);
    try {
      const res = await authenticatedPost<{ style_guide: string }>(
        "/api/v1/current-affairs/admin/ai/extract-style",
        token,
        { source_text: subjectSampleText }
      );

      if (res && res.style_guide) {
        setOverridePrompt(res.style_guide);
        showMessage("Content style analyzed! Prompts populated below.");
      } else {
        throw new Error("No style guidelines returned from AI.");
      }
    } catch (err: any) {
      console.error("Error analyzing subject style:", err);
      showMessage("Failed to replicate style: " + (err.message || err), "error");
    } finally {
      setGeneratingStyle(false);
    }
  };

  // Delete instruction override
  const handleDeleteInstruction = async (id: number) => {
    if (!token || !window.confirm("Remove this override instruction?")) return;
    try {
      await authenticatedDelete(`/api/v1/current-affairs/admin/ai/instructions/${id}`, token);
      setInstructions(prev => prev.filter(i => i.id !== id));
      showMessage("Override instruction removed.");
    } catch (err) {
      showMessage("Failed to delete instruction", "error");
    }
  };

  const subjectCategories = categories.filter(c => c.is_active !== false);

  return (
    <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
      {/* Tab Switcher */}
      <div className="border-b border-line bg-paper/50 p-3">
        <div className={tabStripClass()}>
          <button onClick={() => setActiveSubTab("articles")} className={tabButtonClass(activeSubTab === "articles")} type="button">
            <BookOpen className="h-4 w-4" />
            Article Styles & Prompts
          </button>
          <button onClick={() => setActiveSubTab("quizzes")} className={tabButtonClass(activeSubTab === "quizzes")} type="button">
            <Brain className="h-4 w-4" />
            Quiz Styles & Prompts
          </button>
          <button onClick={() => setActiveSubTab("subject-prompts")} className={tabButtonClass(activeSubTab === "subject-prompts")} type="button">
            <Plus className="h-4 w-4" />
            Subject-Level Prompts
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 text-sm font-bold flex items-center gap-2 border-b border-line ${
          message.type === "success" 
            ? "bg-civic/5 text-civic border-civic/20" 
            : "bg-berry/5 text-berry border-berry/20"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3 text-ink/60">
          <Loader2 className="h-8 w-8 text-civic animate-spin" />
          <span className="text-sm font-medium">Loading AI configurations...</span>
        </div>
      ) : (
        <div className="p-6 space-y-8">
          
          {/* AI Settings Subpages Dashboard */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-ink/40 uppercase tracking-wider">Restructured AI Article Generation Settings</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Daily News AI Settings",
                  desc: "Configure style guides & category overrides for Daily Current Affairs factual articles.",
                  href: "/admin/current-affairs/ai-settings/daily-news",
                  color: "border-emerald-200 bg-emerald-50/10 hover:border-emerald-400 hover:bg-emerald-50/20 text-emerald-800",
                  icon: <Newspaper className="h-5 w-5 text-emerald-600" />
                },
                {
                  title: "Summaries AI Settings",
                  desc: "Configure style guides & category overrides for Daily Editorial Summaries and reviews.",
                  href: "/admin/current-affairs/ai-settings/summaries",
                  color: "border-blue-200 bg-blue-50/10 hover:border-blue-400 hover:bg-blue-50/20 text-blue-800",
                  icon: <BookOpen className="h-5 w-5 text-blue-600" />
                },
                {
                  title: "Mains Notes AI Settings",
                  desc: "Configure style guides & category overrides for Mains Topic Notes and GS syllabus papers.",
                  href: "/admin/current-affairs/ai-settings/mains-notes",
                  color: "border-indigo-200 bg-indigo-50/10 hover:border-indigo-400 hover:bg-indigo-50/20 text-indigo-800",
                  icon: <FileText className="h-5 w-5 text-indigo-600" />
                }
              ].map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className={`flex flex-col justify-between p-4 rounded-xl border transition-all hover:shadow-sm group ${card.color}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white border border-line shadow-xs">
                        {card.icon}
                      </span>
                      <h4 className="font-extrabold text-sm text-ink group-hover:text-civic transition-colors">{card.title}</h4>
                    </div>
                    <p className="text-[11px] text-ink/65 leading-relaxed">{card.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-civic mt-3 group-hover:underline">
                    Manage Instructions
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="border-t border-line/60 pt-6">
            {(activeSubTab === "articles" || activeSubTab === "quizzes") && (
              <div className="space-y-6 animate-in fade-in duration-300">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
                <div>
                  <h3 className="text-lg font-black text-ink">
                    {activeSubTab === "articles" ? "Article Layout Styling Guides" : "Assessment Quiz Style Guides"}
                  </h3>
                  <p className="text-xs text-ink/60 mt-1">
                    Select a content format or test type to modify its specific AI writing style guide and prompt instructions.
                  </p>
                </div>
                
                {/* Format Dropdown Selector */}
                <label className="flex items-center gap-2 text-xs font-black text-ink shrink-0">
                  Target Type:
                  <select
                    value={activeSubTab === "articles" ? selectedArticleKind : selectedQuizType}
                    onChange={(e) => {
                      if (activeSubTab === "articles") {
                        setSelectedArticleKind(e.target.value);
                      } else {
                        setSelectedQuizType(e.target.value);
                      }
                    }}
                    className="h-10 rounded-xl border border-line bg-white px-3 text-sm font-bold text-civic outline-none focus:border-civic"
                  >
                    {activeSubTab === "articles" 
                      ? ARTICLE_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)
                      : QUIZ_TYPES.map(q => <option key={q.value} value={q.value}>{q.label}</option>)
                    }
                  </select>
                </label>
              </div>

              {/* Editing workspaces */}
              <div className="grid gap-6 lg:grid-cols-2">
                
                {/* Left Side: Style Guide Markdown */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-civic tracking-wide uppercase">Writing Rules</span>
                    <h4 className="text-sm font-black text-ink">Style Guide Constraints (Markdown)</h4>
                    <p className="text-[11px] text-ink/50 leading-tight">Applied as a secondary style parameter to guide layout structure, heading tags, and content tones.</p>
                  </div>
                  
                  <textarea
                    value={styleGuide.style_guide || ""}
                    onChange={(e) => setStyleGuide(prev => ({ ...prev, style_guide: e.target.value }))}
                    placeholder="e.g. Write in a neutral tone. Present stats in bullet lists. Highlight important terms in bold."
                    className="w-full min-h-[220px] rounded-xl border border-line p-4 text-sm font-mono leading-relaxed outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all resize-y"
                  />

                  {/* Scrape text extractor */}
                  <div className="border border-line rounded-xl p-4 bg-paper/20 space-y-3">
                    <label className="block text-xs font-bold text-ink">
                      Writing Sample Text Extractor
                      <textarea
                        value={styleGuide.source_text || ""}
                        onChange={(e) => setStyleGuide(prev => ({ ...prev, source_text: e.target.value }))}
                        placeholder="Paste reference text here..."
                        className="w-full min-h-[100px] mt-1.5 rounded-lg border border-line p-3 text-xs bg-white outline-none focus:border-civic transition-all"
                      />
                    </label>
                    <button
                      onClick={handleAnalyzeStyle}
                      disabled={saving || !styleGuide.source_text?.trim()}
                      className="inline-flex items-center gap-2 px-3 h-8 border border-civic text-civic hover:bg-civic/5 font-bold rounded-lg text-[10px] transition-all active:scale-[0.98] disabled:opacity-55 touch-manipulation"
                      type="button"
                    >
                      {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Extract Rules
                    </button>
                  </div>
                </div>

                {/* Right Side: System Prompts */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-civic tracking-wide uppercase">Instructions Prompt</span>
                    <h4 className="text-sm font-black text-ink">AI Prompt Instructions</h4>
                    <p className="text-[11px] text-ink/50 leading-tight">The primary system instruction query set. This teaches the AI what sections, components, or parameters are required.</p>
                  </div>

                  <textarea
                    value={promptValue || ""}
                    onChange={(e) => setPromptValue(e.target.value)}
                    placeholder="e.g. You are a UPSC content specialist. Generate comprehensive notes including Syllabus mapping, Background Context, Pillars, Way Forward..."
                    className="w-full min-h-[365px] rounded-xl border border-line p-4 text-sm font-mono leading-relaxed outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all resize-y"
                  />
                </div>
              </div>

              {/* Save Footer Button */}
              <div className="flex justify-end pt-4 border-t border-line">
                <button
                  onClick={handleSaveStyleAndPrompt}
                  disabled={saving}
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-civic text-white font-bold text-sm shadow-md hover:bg-civic/90 transition-all active:scale-[0.98]"
                  type="button"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Layout Style Settings
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Subject Overrides */}
          {activeSubTab === "subject-prompts" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h3 className="text-lg font-black text-ink">Subject-Level Custom Prompts</h3>
                <p className="text-xs text-ink/60 mt-1">
                  Configure specific instruction overrides for different syllabus categories. When generating articles or notes within these categories, the AI system will append these guidelines.
                </p>
              </div>

              <div className="grid gap-8 lg:grid-cols-[1.2fr_1.8fr]">
                {/* Create Form */}
                <form onSubmit={handleSaveSubjectPrompt} className="border border-line rounded-xl p-5 space-y-4 bg-paper/20">
                  <h4 className="font-extrabold text-sm text-ink border-b border-line pb-2 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-civic" />
                    Add Subject Override
                  </h4>

                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Select Subject Node
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-normal outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      required
                    >
                      <option value="">-- Choose Subject Category --</option>
                      {subjectCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({cat.content_family})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Instruction Summary / Title
                    <input
                      type="text"
                      placeholder="e.g. GS Paper II polity structure prompt"
                      value={overrideTitle}
                      onChange={(e) => setOverrideTitle(e.target.value)}
                      className="h-10 rounded-lg border border-line px-3 text-sm font-normal outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      required
                    />
                  </label>

                  <div className="border border-line rounded-lg p-3.5 bg-white space-y-2.5 shadow-sm">
                    <span className="block text-[11px] font-bold text-indigo-700 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Style Replicator (Optional)
                    </span>
                    <p className="text-[10px] text-ink/50 leading-tight">
                      Paste a reference article style sample below. The AI will extract a prompt replicating its formatting and content style.
                    </p>
                    <textarea
                      placeholder="Paste reference writing style sample here..."
                      value={subjectSampleText || ""}
                      onChange={(e) => setSubjectSampleText(e.target.value)}
                      className="w-full min-h-[90px] rounded-lg border border-line p-2.5 text-xs bg-white outline-none focus:border-civic transition-all resize-y font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateSubjectStylePrompt}
                      disabled={generatingStyle || !subjectSampleText.trim()}
                      className="inline-flex items-center gap-1.5 px-3 h-8 border border-civic text-civic hover:bg-civic/5 font-bold rounded-lg text-[10px] transition-all disabled:opacity-50"
                    >
                      {generatingStyle ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Replicate Writing Style
                    </button>
                  </div>

                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Custom Prompt Guidelines
                    <textarea
                      placeholder="e.g. For Indian Polity articles, always focus on supreme court precedent, historical background, relevant constitutional articles, and potential legislative reforms."
                      value={overridePrompt || ""}
                      onChange={(e) => setOverridePrompt(e.target.value)}
                      className="min-h-[140px] rounded-lg border border-line p-3 text-sm font-normal outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 resize-y"
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-civic text-white font-bold text-xs shadow-md hover:bg-civic/90 transition-all"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save Override Instruction
                  </button>
                </form>

                {/* List Overrides */}
                <div className="space-y-4">
                  <h4 className="font-extrabold text-sm text-ink flex items-center gap-2">
                    Active Instruction Overrides ({instructions.filter(i => i.scope === "subject").length})
                  </h4>

                  {instructions.filter(i => i.scope === "subject").length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line bg-paper/10 p-12 text-center text-xs text-ink/50">
                      No custom instructions or overrides configured yet. Custom Prompts will fallback to general AI styling.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {instructions.filter(i => i.scope === "subject").map(inst => {
                        const targetCategory = categories.find(c => c.id === inst.subject_node_id);
                        return (
                          <div key={inst.id} className="border border-line bg-white rounded-xl p-4 shadow-sm hover:border-civic/50 transition-all flex justify-between items-start gap-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-ink">{inst.title}</span>
                                <span className="rounded-md bg-paper px-2 py-0.5 text-[10px] font-bold text-civic uppercase">
                                  Scope: {inst.scope}
                                </span>
                                {targetCategory && (
                                  <span className="rounded-md bg-civic/10 px-2 py-0.5 text-[10px] font-bold text-civic">
                                    Subject: {targetCategory.name}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-ink/75 font-mono bg-paper/50 rounded-lg p-2 leading-relaxed whitespace-pre-wrap">
                                {inst.prompt}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteInstruction(inst.id)}
                              type="button"
                              className="h-8 w-8 shrink-0 border border-line rounded-lg flex items-center justify-center hover:border-berry text-ink hover:text-berry hover:bg-berry/5 transition-all"
                              title="Delete Override"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

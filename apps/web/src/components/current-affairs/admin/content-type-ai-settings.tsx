"use client";

import { 
  Sparkles, Save, Plus, Trash2, CheckCircle2, 
  Loader2, AlertCircle, HelpCircle, ArrowLeft, 
  BookOpen, FileText, Newspaper, FileCode, Brain 
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { authenticatedGet, authenticatedPost, authenticatedDelete, useAuth } from "../../auth/auth-context";
import type { CategoryNode } from "../../../lib/api";

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

const VIEW_MAPPING = {
  "daily-news": {
    contentType: "daily_current_affairs",
    label: "Daily News Settings",
    description: "Configure prompts and layout rules for Daily Current Affairs factual news articles.",
    icon: <Newspaper className="h-5 w-5 text-emerald-600" />
  },
  "prelims-pyq": {
    contentType: "prelims_pyq",
    label: "Prelims PYQ Settings",
    description: "Configure prompts and formatting rules for Prelims Past Year Questions.",
    icon: <BookOpen className="h-5 w-5 text-teal-600" />
  },
  "summaries": {
    contentType: "daily_editorial_summary",
    label: "Summaries Settings",
    description: "Configure prompts and styling rules for Daily Editorial Summaries and breakdowns.",
    icon: <BookOpen className="h-5 w-5 text-blue-600" />
  },
  "mains-notes": {
    contentType: "mains_topic_note",
    label: "Mains Notes Settings",
    description: "Configure prompts and syllabus layouts for Mains Topic Notes and subject analyses.",
    icon: <FileText className="h-5 w-5 text-indigo-600" />
  },
  "mains-pyq": {
    contentType: "mains_pyq",
    label: "Mains PYQ Settings",
    description: "Configure prompts and answering guidelines for Mains Past Year Questions.",
    icon: <Brain className="h-5 w-5 text-pink-600" />
  }
};

interface ContentTypeAiSettingsProps {
  subView: "daily-news" | "summaries" | "mains-notes" | "prelims-pyq" | "mains-pyq";
}

export function ContentTypeAiSettings({ subView }: ContentTypeAiSettingsProps) {
  const { token } = useAuth();
  const config = VIEW_MAPPING[subView];
  const contentType = config.contentType;

  // Data states
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [instructions, setInstructions] = useState<AiInstruction[]>([]);
  
  // General editor states
  const [styleGuide, setStyleGuide] = useState<StyleGuideState>({ style_guide: "", source_text: "" });
  const [promptValue, setPromptValue] = useState<string>("");

  // Override Form states
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [overrideTitle, setOverrideTitle] = useState<string>("");
  const [overridePrompt, setOverridePrompt] = useState<string>("");
  const [overrideSampleText, setOverrideSampleText] = useState<string>("");

  // Loading & Action states
  const [loading, setLoading] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [extractingGeneral, setExtractingGeneral] = useState(false);
  const [extractingOverride, setExtractingOverride] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Load style guide, instructions, and categories
  const loadConfiguration = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // 1. Fetch categories
      const cats = await authenticatedGet<CategoryNode[]>("/api/v1/current-affairs/categories?limit=200", token);
      setCategories(cats || []);

      // 2. Fetch style guide for this content type
      const guide = await authenticatedGet<StyleGuideState>(
        `/api/v1/current-affairs/admin/ai/style-guide?content_type=${contentType}`,
        token
      );
      setStyleGuide(guide || { style_guide: "", source_text: "" });

      // 3. Fetch all instructions
      const allInsts = await authenticatedGet<AiInstruction[]>("/api/v1/current-affairs/admin/ai/instructions", token);
      setInstructions(allInsts || []);

      // 4. Find matching general instruction
      const match = allInsts?.find(
        i => i.scope === "article" && i.content_type === contentType
      );
      setPromptValue(match ? match.prompt : "");
    } catch (err) {
      console.error("Error loading settings:", err);
      showMessage("Failed to load configurations", "error");
    } finally {
      setLoading(false);
    }
  }, [token, contentType]);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  // Handle saving general style guide & prompt
  const handleSaveGeneral = async () => {
    if (!token) return;
    setSavingGeneral(true);
    try {
      // 1. Save style guide
      await authenticatedPost("/api/v1/current-affairs/admin/ai/style-guide", token, {
        style_guide: styleGuide.style_guide,
        source_text: styleGuide.source_text || null,
        content_type: contentType
      });

      // 2. Save prompt
      await authenticatedPost("/api/v1/current-affairs/admin/ai/instructions", token, {
        scope: "article",
        title: `${config.label} General Instructions`,
        content_type: contentType,
        prompt: promptValue,
        is_active: true
      });

      showMessage("General instructions and styling guide updated successfully!");
      
      // Refresh configurations
      const allInsts = await authenticatedGet<AiInstruction[]>("/api/v1/current-affairs/admin/ai/instructions", token);
      setInstructions(allInsts || []);
    } catch (err) {
      showMessage("Failed to save general configurations", "error");
    } finally {
      setSavingGeneral(false);
    }
  };

  // Extract general writing style constraint
  const handleExtractGeneralStyle = async () => {
    if (!token) return;
    if (!styleGuide.source_text?.trim()) {
      showMessage("Please paste a reference article first", "error");
      return;
    }
    setExtractingGeneral(true);
    try {
      const res = await authenticatedPost<{ style_guide: string }>(
        "/api/v1/current-affairs/admin/ai/extract-style",
        token,
        { source_text: styleGuide.source_text }
      );
      if (res && res.style_guide) {
        setStyleGuide(prev => ({ ...prev, style_guide: res.style_guide }));
        showMessage("Rules successfully extracted and loaded!");
      }
    } catch (err) {
      showMessage("Failed to extract rules", "error");
    } finally {
      setExtractingGeneral(false);
    }
  };

  // Extract override style/prompt
  const handleExtractOverrideStyle = async () => {
    if (!token) return;
    if (!overrideSampleText.trim()) {
      showMessage("Please paste a reference article first", "error");
      return;
    }
    setExtractingOverride(true);
    try {
      const res = await authenticatedPost<{ style_guide: string }>(
        "/api/v1/current-affairs/admin/ai/extract-style",
        token,
        { source_text: overrideSampleText }
      );
      if (res && res.style_guide) {
        setOverridePrompt(res.style_guide);
        showMessage("Override instructions successfully extracted!");
      }
    } catch (err) {
      showMessage("Failed to extract instructions", "error");
    } finally {
      setExtractingOverride(false);
    }
  };

  // Save subject override
  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedSubjectId || !overridePrompt.trim() || !overrideTitle.trim()) {
      showMessage("Please fill all required override fields", "error");
      return;
    }
    setSavingOverride(true);
    try {
      const subjectNodeId = Number(selectedSubjectId);
      const subject = categories.find(c => c.id === subjectNodeId);

      await authenticatedPost("/api/v1/current-affairs/admin/ai/instructions", token, {
        scope: "subject",
        title: overrideTitle,
        subject_node_id: subjectNodeId,
        content_type: contentType,
        prompt: overridePrompt,
        is_active: true
      });

      // Clear override form states
      setOverridePrompt("");
      setOverrideTitle("");
      setSelectedSubjectId("");
      setOverrideSampleText("");
      setShowOverrideForm(false);

      // Reload matching values
      const allInsts = await authenticatedGet<AiInstruction[]>("/api/v1/current-affairs/admin/ai/instructions", token);
      setInstructions(allInsts || []);

      showMessage(`Category override for '${subject?.name}' saved successfully!`);
    } catch (err) {
      showMessage("Failed to save category override", "error");
    } finally {
      setSavingOverride(false);
    }
  };

  // Delete instruction override
  const handleDeleteInstruction = async (id: number) => {
    if (!token || !window.confirm("Are you sure you want to remove this category override?")) return;
    try {
      await authenticatedDelete(`/api/v1/current-affairs/admin/ai/instructions/${id}`, token);
      setInstructions(prev => prev.filter(i => i.id !== id));
      showMessage("Category override deleted.");
    } catch (err) {
      showMessage("Failed to delete instruction", "error");
    }
  };

  const activeOverrides = instructions.filter(
    i => i.scope === "subject" && i.content_type === contentType
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/current-affairs/ai-settings"
            className="grid h-10 w-10 place-items-center border border-line rounded-xl bg-white text-ink hover:text-civic transition-colors shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 shadow-xs border border-emerald-100">
                {config.icon}
              </span>
              <h2 className="text-2xl font-black text-ink">{config.label}</h2>
            </div>
            <p className="text-xs text-ink/60 mt-1 leading-none">{config.description}</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 text-sm font-bold flex items-center gap-2 border rounded-xl shadow-xs transition-all ${
          message.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-berry/5 text-berry border-berry/20"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" /> : <AlertCircle className="h-4.5 w-4.5 text-berry" />}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-line rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-ink/50 shadow-xs">
          <Loader2 className="h-8 w-8 text-civic animate-spin" />
          <span className="text-sm font-bold">Loading settings workspace...</span>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left/Middle Columns: Editors */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* ── TOP SECTION: GENERAL STYLE & PROMPT CONFIG ── */}
            <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden divide-y divide-line/60">
              {/* Card Header */}
              <div className="p-5 bg-paper/30">
                <span className="text-[10px] font-bold text-civic uppercase tracking-wider">Default Directives</span>
                <h3 className="text-base font-black text-ink mt-0.5">General Content Type Instructions</h3>
                <p className="text-[11px] text-ink/50 leading-tight">These settings apply to all articles of this content type unless overridden by specific category instructions.</p>
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  {/* Left Side: General Style Guide */}
                  <div className="space-y-3">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-extrabold text-ink">Style Guide Constraints (Markdown)</span>
                      <textarea
                        value={styleGuide.style_guide}
                        onChange={(e) => setStyleGuide(prev => ({ ...prev, style_guide: e.target.value }))}
                        placeholder="Define formatting constraints (e.g. use bolding, bullet points, write in a factual tone, do not add intros)."
                        className="w-full min-h-[220px] rounded-xl border border-line p-3 text-xs font-mono leading-relaxed outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all resize-y"
                      />
                    </label>

                    {/* General Sample Scraper */}
                    <div className="border border-line rounded-xl p-3 bg-paper/10 space-y-2">
                      <label className="block">
                        <span className="text-[10px] font-black text-ink block">Extract Rules from Article Example</span>
                        <span className="text-[9px] text-ink/50 leading-none">Paste a reference article text below to extract layout/writing rules automatically.</span>
                        <textarea
                          value={styleGuide.source_text}
                          onChange={(e) => setStyleGuide(prev => ({ ...prev, source_text: e.target.value }))}
                          placeholder="Paste reference writing style example text..."
                          className="w-full min-h-[90px] mt-1.5 rounded-lg border border-line p-2.5 text-[10px] bg-white outline-none focus:border-civic transition-all"
                        />
                      </label>
                      <button
                        onClick={handleExtractGeneralStyle}
                        disabled={extractingGeneral || !styleGuide.source_text?.trim()}
                        className="inline-flex items-center gap-1.5 px-3 h-8 border border-civic text-civic hover:bg-civic/5 font-extrabold rounded-lg text-[10px] transition-all disabled:opacity-50"
                        type="button"
                      >
                        {extractingGeneral ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        Extract Style Rules
                      </button>
                    </div>
                  </div>

                  {/* Right Side: General Prompt */}
                  <div className="space-y-3">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-extrabold text-ink">AI Prompts / System Instructions</span>
                      <textarea
                        value={promptValue}
                        onChange={(e) => setPromptValue(e.target.value)}
                        placeholder="Define main prompts teaching the model how to outline sections, categories, and generate text contents."
                        className="w-full min-h-[352px] rounded-xl border border-line p-3 text-xs font-mono leading-relaxed outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all resize-y"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={handleSaveGeneral}
                    disabled={savingGeneral}
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-civic text-white font-bold text-xs shadow-sm hover:bg-civic/95 transition-all"
                    type="button"
                  >
                    {savingGeneral ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save Layout Style Settings
                  </button>
                </div>
              </div>
            </div>

            {/* ── BOTTOM SECTION: CATEGORY OVERRIDES LIST & PLUS FORM ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-ink">Category-Based AI Instructions</h3>
                  <p className="text-[11px] text-ink/50 mt-0.5 leading-none">Configure special prompt instructions matching target syllabus topics (e.g. Polity precedent vs. Economy statistics).</p>
                </div>
                <button
                  onClick={() => setShowOverrideForm(!showOverrideForm)}
                  className={`inline-flex items-center justify-center h-8 w-8 rounded-lg border transition-all ${
                    showOverrideForm 
                      ? "bg-berry/5 border-berry/20 text-berry hover:bg-berry/10" 
                      : "bg-civic text-white shadow-xs hover:bg-civic/95 border-transparent"
                  }`}
                  title={showOverrideForm ? "Cancel Add" : "Add Override"}
                >
                  {showOverrideForm ? <span className="font-extrabold text-sm">✕</span> : <Plus className="h-4 w-4" />}
                </button>
              </div>

              {/* OVERRIDE CREATOR FORM */}
              {showOverrideForm && (
                <form onSubmit={handleSaveOverride} className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4 animate-in slide-in-from-top duration-300">
                  <h4 className="font-black text-sm text-ink border-b border-line pb-2 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-civic" />
                    Create Category Instruction Override
                  </h4>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-bold text-ink">
                      Syllabus Subject Node *
                      <select
                        value={selectedSubjectId}
                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                        className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                        required
                      >
                        <option value="">-- Choose Category --</option>
                        {categories.filter(c => c.is_active !== false).map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({cat.content_family})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5 text-xs font-bold text-ink">
                      Instruction Override Title / Summary *
                      <input
                        type="text"
                        placeholder="e.g. GS Paper II Indian Polity precedent prompt"
                        value={overrideTitle}
                        onChange={(e) => setOverrideTitle(e.target.value)}
                        className="h-10 rounded-lg border border-line px-3 text-sm outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                        required
                      />
                    </label>
                  </div>

                  {/* Category Prompt Extractor */}
                  <div className="border border-line rounded-xl p-3.5 bg-paper/20 space-y-2">
                    <span className="block text-[11px] font-bold text-indigo-700 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Override Style Extractor
                    </span>
                    <p className="text-[10px] text-ink/50 leading-tight">
                      Paste a high-quality article example for this category. The AI will extract specific guidelines to populate the instructions below.
                    </p>
                    <textarea
                      placeholder="Paste reference category article style sample..."
                      value={overrideSampleText}
                      onChange={(e) => setOverrideSampleText(e.target.value)}
                      className="w-full min-h-[90px] rounded-lg border border-line p-2.5 text-[10px] bg-white outline-none focus:border-civic transition-all resize-y font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleExtractOverrideStyle}
                      disabled={extractingOverride || !overrideSampleText.trim()}
                      className="inline-flex items-center gap-1.5 px-3 h-8 border border-civic text-civic hover:bg-civic/5 font-extrabold rounded-lg text-[10px] transition-all disabled:opacity-50"
                    >
                      {extractingOverride ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Extract Override Guidelines
                    </button>
                  </div>

                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Override Prompt Guidelines *
                    <textarea
                      placeholder="e.g. Focus on Constitutional articles (19, 21, etc.), Supreme Court precedents, and recommend legislative checks and balances."
                      value={overridePrompt}
                      onChange={(e) => setOverridePrompt(e.target.value)}
                      className="min-h-[120px] rounded-lg border border-line p-3 text-sm font-mono outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 resize-y"
                      required
                    />
                  </label>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowOverrideForm(false);
                        setOverridePrompt("");
                        setOverrideTitle("");
                        setSelectedSubjectId("");
                        setOverrideSampleText("");
                      }}
                      className="h-9 px-4 border border-line hover:border-berry/30 hover:text-berry text-ink text-xs font-bold rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingOverride}
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-civic text-white font-bold text-xs shadow-sm hover:bg-civic/95 transition-all"
                    >
                      {savingOverride ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Override Instruction
                    </button>
                  </div>
                </form>
              )}

              {/* LIST OVERRIDES */}
              {activeOverrides.length === 0 ? (
                <div className="bg-white border border-line rounded-2xl p-12 text-center text-xs text-ink/50 shadow-sm">
                  No category-specific overrides configured for this content type. Articles will generate based on general prompt settings.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeOverrides.map(inst => {
                    const targetCategory = categories.find(c => c.id === inst.subject_node_id);
                    return (
                      <div 
                        key={inst.id} 
                        className="border border-line bg-white rounded-xl p-4 shadow-sm hover:border-civic/40 transition-all flex justify-between items-start gap-4 group"
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-extrabold text-ink">{inst.title}</span>
                            {targetCategory && (
                              <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-black text-emerald-800 uppercase">
                                Category: {targetCategory.name}
                              </span>
                            )}
                            <span className="rounded-md bg-paper px-2 py-0.5 text-[9px] font-bold text-civic">
                              Scope: {inst.scope}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink/75 font-mono bg-paper/50 rounded-lg p-2.5 leading-relaxed whitespace-pre-wrap max-h-[180px] overflow-y-auto border border-line/40">
                            {inst.prompt}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteInstruction(inst.id)}
                          type="button"
                          className="h-8 w-8 shrink-0 border border-line rounded-lg flex items-center justify-center hover:border-berry text-ink hover:text-berry hover:bg-berry/5 transition-all opacity-70 group-hover:opacity-100"
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

          {/* Right Column: Best Practices */}
          <div className="space-y-6">
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-black text-sm text-ink flex items-center gap-1.5 pb-2 border-b border-line">
                <HelpCircle className="h-4 w-4 text-civic" />
                Prompt Guidelines & Best Practices
              </h3>

              <div className="space-y-4 text-xs text-ink/70 leading-relaxed">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-ink flex items-center gap-1">
                    <span className="text-[9px] grid h-4 w-4 place-items-center rounded-full bg-civic text-white">1</span>
                    Specify Structure & Output Schema
                  </h4>
                  <p className="pl-5 text-ink/65 leading-normal">
                    Always describe the required outline in detail. Make sure the AI knows what specific sub-headers (e.g. <em>Why in News</em>, <em>Key Takeaways</em>, <em>Way Forward</em>) are needed.
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-extrabold text-ink flex items-center gap-1">
                    <span className="text-[9px] grid h-4 w-4 place-items-center rounded-full bg-civic text-white">2</span>
                    Enforce LaTeX Formatting
                  </h4>
                  <p className="pl-5 text-ink/65 leading-normal">
                    Instructions must specify that all formulas, statistics, percentages, and algebraic symbols are wrapped in single dollar symbols (e.g. <code>$15.4\%$</code> or <code>$10^9$</code>).
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-extrabold text-ink flex items-center gap-1">
                    <span className="text-[9px] grid h-4 w-4 place-items-center rounded-full bg-civic text-white">3</span>
                    Prevent AI Conversational Prose
                  </h4>
                  <p className="pl-5 text-ink/65 leading-normal">
                    Direct the AI model to output <strong>strictly raw JSON</strong> matching the schema. Tell it to skip any text like <em>"Here is the article:"</em> at the beginning or end of its response.
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-extrabold text-ink flex items-center gap-1">
                    <span className="text-[9px] grid h-4 w-4 place-items-center rounded-full bg-civic text-white">4</span>
                    Keep Content Objective & Exam-Oriented
                  </h4>
                  <p className="pl-5 text-ink/65 leading-normal">
                    Direct the model to maintain an analytical, neutral, and academic tone. UPSC articles must balance multiple viewpoints and highlight legal framework links.
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-extrabold text-ink flex items-center gap-1">
                    <span className="text-[9px] grid h-4 w-4 place-items-center rounded-full bg-civic text-white">5</span>
                    Leverage Style Extractor
                  </h4>
                  <p className="pl-5 text-ink/65 leading-normal">
                    Use the <strong>AI Override Style Extractor</strong> card on the left. Paste a high-quality syllabus article to generate rules automatically without writing them from scratch.
                  </p>
                </div>
              </div>
            </div>

            {/* Ingestion Connection Notice */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-black text-sm text-emerald-800 flex items-center gap-1.5">
                <FileCode className="h-4 w-4 text-emerald-600" />
                Ingestion Connection Active
              </h3>
              <p className="text-xs text-emerald-700/80 leading-normal">
                These settings are directly connected to the automated <strong>AI Ingestion Queue</strong>. 
              </p>
              <p className="text-xs text-emerald-700/80 leading-normal">
                When new jobs are parsed, the AI agent uses the taxonomy to assign categories, loads the exact overrides configured here, and outputs pre-approved articles ready for immediate publishing.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

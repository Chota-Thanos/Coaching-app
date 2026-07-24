"use client";

import { Save, Loader2, Sparkles } from "lucide-react";

type Exam = {
  id: number;
  name: string;
  slug: string;
};

type ExamLevel = {
  id: number;
  name: string;
  slug: string;
};

type TaxonomyNode = {
  id: number;
  exam_id: number;
  parent_id?: number | null;
  node_type: string;
  name: string;
  slug: string;
};

type QuestionNature = {
  id: number;
  name: string;
  slug: string;
};

type TaxonomyPanelProps = {
  exams: Exam[];
  selectedExamId: string;
  handleExamChange: (val: string) => void;
  examLevels: ExamLevel[];
  selectedLevelId: string;
  setSelectedLevelId: (val: string) => void;
  selectedSubjectId: string;
  handleSubjectChange: (val: string) => void;
  activeSubjects: TaxonomyNode[];
  selectedSourceBucketId: string;
  handleSourceBucketChange: (val: string) => void;
  activeSourceBuckets: TaxonomyNode[];
  selectedTopicId: string;
  handleTopicChange: (val: string) => void;
  activeTopics: TaxonomyNode[];
  selectedSubtopicId: string;
  setSelectedSubtopicId: (val: string) => void;
  activeSubtopics: TaxonomyNode[];
  questionNatures: QuestionNature[];
  selectedNatureId: string;
  setSelectedNatureId: (val: string) => void;
  onApplyToSelected: () => void;
  onReleaseSelected: () => void;
  selectedCount: number;
  saving: boolean;
};

export function QuizCreatorTaxonomyPanel({
  exams,
  selectedExamId,
  handleExamChange,
  examLevels,
  selectedLevelId,
  setSelectedLevelId,
  selectedSubjectId,
  handleSubjectChange,
  activeSubjects,
  selectedSourceBucketId,
  handleSourceBucketChange,
  activeSourceBuckets,
  selectedTopicId,
  handleTopicChange,
  activeTopics,
  selectedSubtopicId,
  setSelectedSubtopicId,
  activeSubtopics,
  questionNatures,
  selectedNatureId,
  setSelectedNatureId,
  onApplyToSelected,
  onReleaseSelected,
  selectedCount,
  saving
}: TaxonomyPanelProps) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm h-fit space-y-5 animate-in fade-in duration-300">
      <h4 className="font-extrabold text-base text-ink border-b border-line pb-2 flex items-center gap-2">
        <Sparkles className="h-4.5 w-4.5 text-civic" />
        Staging Bulk Actions
      </h4>
      
      <div className="space-y-4">
        {/* TARGET EXAM */}
        <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
          Target Examination
          <select
            value={selectedExamId}
            onChange={(e) => handleExamChange(e.target.value)}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-xs outline-none focus:border-civic"
          >
            <option value="">-- Choose Exam --</option>
            {exams.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
        </label>

        {/* DIFFICULTY LEVEL */}
        <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
          Exam Difficulty Level
          <select
            value={selectedLevelId}
            onChange={(e) => setSelectedLevelId(e.target.value)}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-xs outline-none focus:border-civic"
            disabled={!selectedExamId}
          >
            <option value="">-- Choose Level --</option>
            {examLevels.map(lvl => (
              <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
            ))}
          </select>
        </label>

        {/* QUESTION NATURE */}
        <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
          Question Nature
          <select
            value={selectedNatureId}
            onChange={(e) => setSelectedNatureId(e.target.value)}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-xs outline-none focus:border-civic"
            disabled={!selectedExamId}
          >
            <option value="">-- Choose Nature --</option>
            {questionNatures.map(n => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </label>

        {/* CASCADING ASSESSMENT TAXONOMY SELECTION */}
        <div className="border border-line/60 p-3 rounded-lg bg-slate-50 space-y-3">
          <span className="text-[11px] font-black text-ink uppercase tracking-wider block font-bold">Assessment Syllabus Taxonomy</span>
          
          <label className="grid gap-1 text-[11px] font-bold text-ink">
            Subject Node *
            <select
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-xs outline-none focus:border-civic disabled:opacity-50"
              disabled={!selectedExamId}
            >
              <option value="">-- Select Subject --</option>
              {activeSubjects.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-[11px] font-bold text-ink">
            Source Bucket (Optional)
            <select
              value={selectedSourceBucketId}
              onChange={(e) => handleSourceBucketChange(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-xs outline-none focus:border-civic disabled:opacity-50"
              disabled={!selectedSubjectId}
            >
              <option value="">-- Select Source Bucket --</option>
              {activeSourceBuckets.map(sb => (
                <option key={sb.id} value={sb.id}>{sb.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-[11px] font-bold text-ink">
            Topic Node (Optional)
            <select
              value={selectedTopicId}
              onChange={(e) => handleTopicChange(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-xs outline-none focus:border-civic disabled:opacity-50"
              disabled={!selectedSourceBucketId}
            >
              <option value="">-- Select Topic --</option>
              {activeTopics.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-[11px] font-bold text-ink">
            Subtopic Node (Optional)
            <select
              value={selectedSubtopicId}
              onChange={(e) => setSelectedSubtopicId(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-xs outline-none focus:border-civic disabled:opacity-50"
              disabled={!selectedTopicId}
            >
              <option value="">-- Select Subtopic --</option>
              {activeSubtopics.map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="pt-2 space-y-2 border-t border-line/60">
          <button
            onClick={onApplyToSelected}
            disabled={selectedCount === 0}
            className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-civic text-civic bg-surface font-bold text-xs hover:bg-civic/5 transition-all disabled:opacity-50"
            type="button"
          >
            Apply to Checked ({selectedCount})
          </button>
          
          <button
            onClick={onReleaseSelected}
            disabled={saving || selectedCount === 0}
            className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-civic text-white font-bold text-sm shadow-sm hover:bg-civic/90 active:scale-[0.98] transition-all disabled:opacity-50"
            type="button"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Release Selected ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
}

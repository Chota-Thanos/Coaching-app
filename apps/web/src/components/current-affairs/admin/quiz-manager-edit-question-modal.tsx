"use client";

import { X, Loader2, CheckCircle2 } from "lucide-react";

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
  exam_id: number;
  name: string;
  slug: string;
};

type EditQuestionModalProps = {
  editingQuestion: any;
  onClose: () => void;
  editQuestionForm: {
    question_statement: string;
    supplementary_statement: string;
    question_prompt: string;
    options: { key: string; text: string }[];
    correct_answer: string;
    explanation: string;
    exam_id: string;
    exam_level_id: string;
    subject_node_id: string;
    source_node_id: string;
    topic_node_id: string;
    subtopic_node_id: string;
    question_nature_id: string;
  };
  setEditQuestionForm: any;
  exams: Exam[];
  editQuestionLevels: ExamLevel[];
  editQuestionSubjects: TaxonomyNode[];
  editQuestionSourceBuckets: TaxonomyNode[];
  editQuestionTopics: TaxonomyNode[];
  editQuestionSubtopics: TaxonomyNode[];
  editQuestionNatures: QuestionNature[];
  savingEdit: boolean;
  onSave: () => Promise<void>;
};

export function QuizManagerEditQuestionModal({
  editingQuestion,
  onClose,
  editQuestionForm,
  setEditQuestionForm,
  exams,
  editQuestionLevels,
  editQuestionSubjects,
  editQuestionSourceBuckets,
  editQuestionTopics,
  editQuestionSubtopics,
  editQuestionNatures,
  savingEdit,
  onSave
}: EditQuestionModalProps) {
  if (!editingQuestion) return null;

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col border border-line animate-in zoom-in-95 duration-200">
        
        <div className="p-5 border-b border-line flex justify-between items-center bg-paper rounded-t-2xl">
          <div>
            <h4 className="font-extrabold text-base text-ink">Quick Edit Question Pool Item</h4>
            <p className="text-[10px] text-ink/50 mt-0.5">Question Database ID: #{editingQuestion.id}</p>
          </div>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-ink/5 flex items-center justify-center transition-all"
            type="button"
          >
            <X className="h-4.5 w-4.5 text-ink/60" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 max-h-[70vh]">
          
          <label className="grid gap-1.5 text-xs font-black text-ink">
            Question Statement
            <textarea
              value={editQuestionForm.question_statement || ""}
              onChange={(e) => setEditQuestionForm((prev: any) => ({ ...prev, question_statement: e.target.value }))}
              className="min-h-[90px] rounded-lg border border-line p-3 text-sm font-medium outline-none focus:border-civic"
              rows={3}
            />
          </label>

          <label className="grid gap-1.5 text-xs font-black text-ink">
            Supplementary statement (Facts, paragraphs - Optional)
            <textarea
              value={editQuestionForm.supplementary_statement || ""}
              onChange={(e) => setEditQuestionForm((prev: any) => ({ ...prev, supplementary_statement: e.target.value }))}
              className="min-h-[60px] rounded-lg border border-line p-3 text-sm font-medium outline-none focus:border-civic"
              rows={2}
            />
          </label>

          <label className="grid gap-1.5 text-xs font-black text-ink">
            Question Prompt (e.g. 'Which options are correct?' - Optional)
            <input
              type="text"
              value={editQuestionForm.question_prompt}
              onChange={(e) => setEditQuestionForm((prev: any) => ({ ...prev, question_prompt: e.target.value }))}
              className="h-10 rounded-lg border border-line px-3 text-sm font-medium outline-none focus:border-civic"
            />
          </label>

          {/* Options Inputs */}
          <div className="grid gap-3 sm:grid-cols-2 border border-line/60 p-4 rounded-xl bg-slate-50/50">
            <span className="sm:col-span-2 text-[10px] font-black text-ink uppercase tracking-wider block -mb-1">
              Options Choices
            </span>
            {editQuestionForm.options.map((opt, oIdx) => (
              <label key={opt.key} className="grid gap-1 text-xs font-bold text-ink">
                Option Choice {opt.key}
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => {
                    const nextOpts = [...editQuestionForm.options];
                    nextOpts[oIdx] = { ...opt, text: e.target.value };
                    setEditQuestionForm((prev: any) => ({ ...prev, options: nextOpts }));
                  }}
                  className="h-9 rounded-lg border border-line px-3 text-xs bg-white outline-none focus:border-civic font-medium"
                />
              </label>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
              Correct Option Key
              <select
                value={editQuestionForm.correct_answer}
                onChange={(e) => setEditQuestionForm((prev: any) => ({ ...prev, correct_answer: e.target.value }))}
                className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium outline-none focus:border-civic"
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
              Question Nature Tag
              <select
                value={editQuestionForm.question_nature_id}
                onChange={(e) => setEditQuestionForm((prev: any) => ({ ...prev, question_nature_id: e.target.value }))}
                className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium outline-none focus:border-civic"
              >
                <option value="">-- Choose Nature --</option>
                {editQuestionNatures.map(nature => (
                  <option key={nature.id} value={nature.id}>{nature.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1.5 text-xs font-black text-ink">
            Pedagogical Explanation
            <textarea
              value={editQuestionForm.explanation || ""}
              onChange={(e) => setEditQuestionForm((prev: any) => ({ ...prev, explanation: e.target.value }))}
              className="min-h-[80px] rounded-lg border border-line p-3 text-sm font-medium outline-none focus:border-civic"
              rows={3}
            />
          </label>

          {/* Taxonomy Selection */}
          <div className="border border-line/60 p-4 rounded-xl bg-slate-50/50 space-y-3">
            <span className="text-[10px] font-black text-ink uppercase tracking-wider block font-bold">
              Syllabus Taxonomy Node
            </span>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
                Target Exam
                <select
                  value={editQuestionForm.exam_id}
                  onChange={(e) => setEditQuestionForm((prev: any) => ({ ...prev, exam_id: e.target.value, exam_level_id: "", subject_node_id: "", source_node_id: "", topic_node_id: "", subtopic_node_id: "" }))}
                  className="h-10 rounded-lg border border-line bg-white px-3 text-xs font-medium outline-none focus:border-civic"
                >
                  <option value="">-- Choose Exam --</option>
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
                Difficulty Level
                <select
                  value={editQuestionForm.exam_level_id}
                  onChange={(e) => setEditQuestionForm((prev: any) => ({ ...prev, exam_level_id: e.target.value }))}
                  disabled={!editQuestionForm.exam_id}
                  className="h-10 rounded-lg border border-line bg-white px-3 text-xs font-medium outline-none focus:border-civic disabled:opacity-55"
                >
                  <option value="">-- Choose Level --</option>
                  {editQuestionLevels.map(lvl => (
                    <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="grid gap-1 text-[11px] font-bold text-ink">
                Subject Node
                <select
                  value={editQuestionForm.subject_node_id}
                  onChange={(e) => setEditQuestionForm((prev: any) => ({ ...prev, subject_node_id: e.target.value, source_node_id: "", topic_node_id: "", subtopic_node_id: "" }))}
                  className="h-9 rounded-lg border border-line bg-white px-2 text-xs outline-none focus:border-civic disabled:opacity-50"
                  disabled={!editQuestionForm.exam_id}
                >
                  <option value="">-- Select Subject --</option>
                  {editQuestionSubjects.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-[11px] font-bold text-ink">
                Source Bucket (Optional)
                <select
                  value={editQuestionForm.source_node_id}
                  onChange={(e) => setEditQuestionForm((prev: any) => ({ ...prev, source_node_id: e.target.value, topic_node_id: "", subtopic_node_id: "" }))}
                  className="h-9 rounded-lg border border-line bg-white px-2 text-xs outline-none focus:border-civic disabled:opacity-50"
                  disabled={!editQuestionForm.subject_node_id}
                >
                  <option value="">-- Select Source Bucket --</option>
                  {editQuestionSourceBuckets.map(sb => (
                    <option key={sb.id} value={sb.id}>{sb.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-[11px] font-bold text-ink">
                Topic Node (Optional)
                <select
                  value={editQuestionForm.topic_node_id}
                  onChange={(e) => setEditQuestionForm((prev: any) => ({ ...prev, topic_node_id: e.target.value, subtopic_node_id: "" }))}
                  className="h-9 rounded-lg border border-line bg-white px-2 text-xs outline-none focus:border-civic disabled:opacity-50"
                  disabled={!editQuestionForm.source_node_id}
                >
                  <option value="">-- Select Topic --</option>
                  {editQuestionTopics.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-[11px] font-bold text-ink">
                Subtopic (Optional)
                <select
                  value={editQuestionForm.subtopic_node_id}
                  onChange={(e) => setEditQuestionForm((prev: any) => ({ ...prev, subtopic_node_id: e.target.value }))}
                  className="h-9 rounded-lg border border-line bg-white px-2 text-xs outline-none focus:border-civic disabled:opacity-50"
                  disabled={!editQuestionForm.topic_node_id}
                >
                  <option value="">-- Select Subtopic --</option>
                  {editQuestionSubtopics.map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-line flex justify-end gap-2 bg-paper rounded-b-2xl">
          <button
            onClick={onClose}
            className="h-10 px-5 bg-white border border-line rounded-xl text-xs font-bold text-ink hover:border-civic transition-all"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={savingEdit}
            className="h-10 px-5 bg-civic text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:bg-civic/90 transition-all"
            type="button"
          >
            {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Apply Edits
          </button>
        </div>

      </div>
    </div>
  );
}

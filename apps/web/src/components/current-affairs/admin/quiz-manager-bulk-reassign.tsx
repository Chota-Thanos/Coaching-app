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

type BulkReassignProps = {
  bulkModalOpen: boolean;
  onClose: () => void;
  activeRepo: "gk" | "aptitude" | "mains";
  selectedQuizIds: number[];
  selectedQuestionIds: number[];
  exams: Exam[];
  bulkFormLevels: ExamLevel[];
  bulkForm: {
    exam_id: string;
    exam_level_id: string;
    subject_node_id: string;
    source_node_id: string;
    topic_node_id: string;
    subtopic_node_id: string;
    question_nature_id: string;
    status: string;
  };
  setBulkForm: any;
  bulkSubjects: TaxonomyNode[];
  bulkSourceBuckets: TaxonomyNode[];
  bulkTopics: TaxonomyNode[];
  bulkSubtopics: TaxonomyNode[];
  questionNatures: QuestionNature[];
  savingBulk: boolean;
  onSubmit: () => Promise<void>;
};

export function QuizManagerBulkReassign({
  bulkModalOpen,
  onClose,
  activeRepo,
  selectedQuizIds,
  selectedQuestionIds,
  exams,
  bulkFormLevels,
  bulkForm,
  setBulkForm,
  bulkSubjects,
  bulkSourceBuckets,
  bulkTopics,
  bulkSubtopics,
  questionNatures,
  savingBulk,
  onSubmit
}: BulkReassignProps) {
  if (!bulkModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col border border-line animate-in zoom-in-95 duration-200">
        
        <div className="p-5 border-b border-line flex justify-between items-center bg-paper rounded-t-2xl">
          <div>
            <h4 className="font-extrabold text-base text-ink">Bulk Category & Taxonomy Reassignment</h4>
            <p className="text-[10px] text-ink/50 mt-0.5">
              Updating {activeRepo === "mains" ? selectedQuizIds.length : selectedQuestionIds.length} items in bulk
            </p>
          </div>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-ink/5 flex items-center justify-center transition-all"
            type="button"
          >
            <X className="h-4.5 w-4.5 text-ink/60" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
            Target Examination *
            <select
              value={bulkForm.exam_id}
              onChange={(e) => setBulkForm((prev: any) => ({ ...prev, exam_id: e.target.value, exam_level_id: "", subject_node_id: "", source_node_id: "", topic_node_id: "", subtopic_node_id: "" }))}
              className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
            >
              <option value="">-- Choose Exam --</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
            Exam Difficulty Level
            <select
              value={bulkForm.exam_level_id}
              onChange={(e) => setBulkForm((prev: any) => ({ ...prev, exam_level_id: e.target.value }))}
              disabled={!bulkForm.exam_id}
              className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic disabled:opacity-55"
            >
              <option value="">-- Choose Level --</option>
              {bulkFormLevels.map(lvl => (
                <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
            Update Status (Optional)
            <select
              value={bulkForm.status}
              onChange={(e) => setBulkForm((prev: any) => ({ ...prev, status: e.target.value }))}
              className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
            >
              <option value="">-- No Change --</option>
              <option value="draft">Draft</option>
              <option value="in_review">In Review</option>
              {activeRepo !== "mains" && <option value="approved">Approved</option>}
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <div className="border-t border-line/60 my-2 pt-2"></div>

          <div className="border border-line/60 p-3 rounded-lg bg-surface/30 space-y-3">
            <span className="text-[11px] font-black text-ink uppercase tracking-wider block font-bold">
              {activeRepo === "mains" ? "Mains Subjective Syllabus" : "Syllabus Taxonomy Node"}
            </span>

            {activeRepo === "mains" ? (
              <>
                <label className="grid gap-1 text-[11px] font-bold text-ink">
                  Paper Node
                  <select
                    value={bulkForm.subject_node_id}
                    onChange={(e) => setBulkForm((prev: any) => ({ ...prev, subject_node_id: e.target.value, topic_node_id: "", subtopic_node_id: "" }))}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic disabled:opacity-50"
                    disabled={!bulkForm.exam_id}
                  >
                    <option value="">-- Select Paper --</option>
                    {bulkSubjects.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] font-bold text-ink">
                  Subject Area Node (Optional)
                  <select
                    value={bulkForm.topic_node_id}
                    onChange={(e) => setBulkForm((prev: any) => ({ ...prev, topic_node_id: e.target.value, subtopic_node_id: "" }))}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic disabled:opacity-50"
                    disabled={!bulkForm.subject_node_id}
                  >
                    <option value="">-- Select Subject Area --</option>
                    <option value="null">-- Clear Subject Area --</option>
                    {bulkTopics.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] font-bold text-ink">
                  Theme Node (Optional)
                  <select
                    value={bulkForm.subtopic_node_id}
                    onChange={(e) => setBulkForm((prev: any) => ({ ...prev, subtopic_node_id: e.target.value }))}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic disabled:opacity-50"
                    disabled={!bulkForm.topic_node_id}
                  >
                    <option value="">-- Select Theme --</option>
                    <option value="null">-- Clear Theme --</option>
                    {bulkSubtopics.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="grid gap-1 text-[11px] font-bold text-ink">
                  Subject Node
                  <select
                    value={bulkForm.subject_node_id}
                    onChange={(e) => setBulkForm((prev: any) => ({ ...prev, subject_node_id: e.target.value, source_node_id: "", topic_node_id: "", subtopic_node_id: "" }))}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic disabled:opacity-50"
                    disabled={!bulkForm.exam_id}
                  >
                    <option value="">-- Select Subject --</option>
                    {bulkSubjects.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] font-bold text-ink">
                  Source Bucket Node (Optional)
                  <select
                    value={bulkForm.source_node_id}
                    onChange={(e) => setBulkForm((prev: any) => ({ ...prev, source_node_id: e.target.value, topic_node_id: "", subtopic_node_id: "" }))}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic disabled:opacity-50"
                    disabled={!bulkForm.subject_node_id}
                  >
                    <option value="">-- Select Source Bucket --</option>
                    <option value="null">-- Clear Source Bucket --</option>
                    {bulkSourceBuckets.map(sb => (
                      <option key={sb.id} value={sb.id}>{sb.name}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] font-bold text-ink">
                  Topic Node (Optional)
                  <select
                    value={bulkForm.topic_node_id}
                    onChange={(e) => setBulkForm((prev: any) => ({ ...prev, topic_node_id: e.target.value, subtopic_node_id: "" }))}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic disabled:opacity-50"
                    disabled={!bulkForm.source_node_id}
                  >
                    <option value="">-- Select Topic --</option>
                    <option value="null">-- Clear Topic --</option>
                    {bulkTopics.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] font-bold text-ink">
                  Subtopic Node (Optional)
                  <select
                    value={bulkForm.subtopic_node_id}
                    onChange={(e) => setBulkForm((prev: any) => ({ ...prev, subtopic_node_id: e.target.value }))}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic disabled:opacity-50"
                    disabled={!bulkForm.topic_node_id}
                  >
                    <option value="">-- Select Subtopic --</option>
                    <option value="null">-- Clear Subtopic --</option>
                    {bulkSubtopics.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>

          {activeRepo !== "mains" && (
            <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
              Question Nature (Optional)
              <select
                value={bulkForm.question_nature_id}
                onChange={(e) => setBulkForm((prev: any) => ({ ...prev, question_nature_id: e.target.value }))}
                className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
              >
                <option value="">-- No Change --</option>
                <option value="null">-- Clear Nature --</option>
                {questionNatures.map(nature => (
                  <option key={nature.id} value={nature.id}>{nature.name}</option>
                ))}
              </select>
            </label>
          )}
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
            onClick={onSubmit}
            disabled={savingBulk || !bulkForm.exam_id}
            className="h-10 px-5 bg-civic text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:bg-civic/90 transition-all"
            type="button"
          >
            {savingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Apply Reassignment
          </button>
        </div>

      </div>
    </div>
  );
}

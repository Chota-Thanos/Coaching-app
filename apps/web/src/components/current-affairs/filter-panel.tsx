"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, X } from "lucide-react";
import type { ArticleFiltersResponse, CategoryNode } from "../../lib/api";
import type { CurrentAffairsHub } from "../../lib/current-affairs";
import { monthLabel } from "../../lib/current-affairs";

type FilterPanelProps = {
  hub: CurrentAffairsHub;
  filters: ArticleFiltersResponse;
  selectedCategory?: string;
  selectedMonth?: string;
  selectedYear?: string;
};

function categoryValue(category: CategoryNode): string {
  return category.slug || String(category.id);
}

export function FilterPanel({
  hub,
  filters,
  selectedCategory,
  selectedMonth,
  selectedYear
}: FilterPanelProps) {
  const categories = filters.categories;

  const gsPapers = useMemo(() => categories.filter((c) => c.node_type === "gs_paper"), [categories]);
  const hasGsPapers = gsPapers.length > 0;
  const allSubjects = useMemo(() => categories.filter((c) => c.node_type === "subject"), [categories]);
  const allTopics = useMemo(() => categories.filter((c) => c.node_type === "topic"), [categories]);
  const allSubtopics = useMemo(() => categories.filter((c) => c.node_type === "subtopic"), [categories]);

  const [gsPaperId, setGsPaperId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [subtopicId, setSubtopicId] = useState("");

  // Resolve the URL's current category value (slug or id, at any level) into
  // its full ancestor chain so the cascading selects preselect correctly.
  useEffect(() => {
    if (!selectedCategory) {
      setGsPaperId("");
      setSubjectId("");
      setTopicId("");
      setSubtopicId("");
      return;
    }

    const match = categories.find((c) => categoryValue(c) === selectedCategory);
    if (!match) return;

    if (match.node_type === "subtopic") {
      setSubtopicId(String(match.id));
      const topic = allTopics.find((t) => t.id === match.parent_id);
      setTopicId(topic ? String(topic.id) : "");
      const subject = topic ? allSubjects.find((s) => s.id === topic.parent_id) : undefined;
      setSubjectId(subject ? String(subject.id) : "");
      const paper = subject ? gsPapers.find((g) => g.id === subject.parent_id) : undefined;
      setGsPaperId(paper ? String(paper.id) : "");
    } else if (match.node_type === "topic") {
      setSubtopicId("");
      setTopicId(String(match.id));
      const subject = allSubjects.find((s) => s.id === match.parent_id);
      setSubjectId(subject ? String(subject.id) : "");
      const paper = subject ? gsPapers.find((g) => g.id === subject.parent_id) : undefined;
      setGsPaperId(paper ? String(paper.id) : "");
    } else if (match.node_type === "subject") {
      setSubtopicId("");
      setTopicId("");
      setSubjectId(String(match.id));
      const paper = gsPapers.find((g) => g.id === match.parent_id);
      setGsPaperId(paper ? String(paper.id) : "");
    } else if (match.node_type === "gs_paper") {
      setSubtopicId("");
      setTopicId("");
      setSubjectId("");
      setGsPaperId(String(match.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, categories]);

  const subjects = useMemo(() => {
    if (!gsPaperId) return allSubjects;
    return allSubjects.filter((s) => String(s.parent_id) === gsPaperId);
  }, [allSubjects, gsPaperId]);

  const topics = useMemo(() => {
    if (!subjectId) return [];
    return allTopics.filter((t) => String(t.parent_id) === subjectId);
  }, [allTopics, subjectId]);

  const subtopics = useMemo(() => {
    if (!topicId) return [];
    return allSubtopics.filter((st) => String(st.parent_id) === topicId);
  }, [allSubtopics, topicId]);

  const selectedNode = useMemo(() => {
    const deepestId = subtopicId || topicId || subjectId || gsPaperId;
    if (!deepestId) return null;
    return categories.find((c) => String(c.id) === deepestId) ?? null;
  }, [categories, subtopicId, topicId, subjectId, gsPaperId]);

  const finalCategoryValue = selectedNode ? categoryValue(selectedNode) : "";
  const hasActiveFilter = Boolean(finalCategoryValue || selectedMonth || selectedYear);

  function handleGsPaperChange(value: string): void {
    setGsPaperId(value);
    setSubjectId("");
    setTopicId("");
    setSubtopicId("");
  }

  function handleSubjectChange(value: string): void {
    setSubjectId(value);
    setTopicId("");
    setSubtopicId("");
  }

  function handleTopicChange(value: string): void {
    setTopicId(value);
    setSubtopicId("");
  }

  return (
    <form
      action={`/current-affairs/${hub.path}`}
      className="flex flex-wrap items-center gap-2"
      method="get"
    >
      <input name="page" type="hidden" value="1" />
      <input name="category" type="hidden" value={finalCategoryValue} />

      {hasGsPapers && (
        <select
          className="h-9 max-w-[170px] rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-civic focus:border-civic focus:outline-none focus:ring-2 focus:ring-civic/20"
          aria-label="Filter by GS Paper"
          onChange={(e) => handleGsPaperChange(e.target.value)}
          value={gsPaperId}
        >
          <option value="">All GS Papers</option>
          {gsPapers.map((paper) => (
            <option key={paper.id} value={paper.id}>{paper.name}</option>
          ))}
        </select>
      )}

      <select
        className="h-9 max-w-[180px] rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-civic focus:border-civic focus:outline-none focus:ring-2 focus:ring-civic/20"
        aria-label="Filter by subject"
        onChange={(e) => handleSubjectChange(e.target.value)}
        value={subjectId}
      >
        <option value="">All Subjects</option>
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>{subject.name}</option>
        ))}
      </select>

      {topics.length > 0 && (
        <select
          className="h-9 max-w-[180px] rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-civic focus:border-civic focus:outline-none focus:ring-2 focus:ring-civic/20"
          aria-label="Filter by topic"
          onChange={(e) => handleTopicChange(e.target.value)}
          value={topicId}
        >
          <option value="">All Topics</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>{topic.name}</option>
          ))}
        </select>
      )}

      {subtopics.length > 0 && (
        <select
          className="h-9 max-w-[180px] rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-civic focus:border-civic focus:outline-none focus:ring-2 focus:ring-civic/20"
          aria-label="Filter by subtopic"
          onChange={(e) => setSubtopicId(e.target.value)}
          value={subtopicId}
        >
          <option value="">All Subtopics</option>
          {subtopics.map((subtopic) => (
            <option key={subtopic.id} value={subtopic.id}>{subtopic.name}</option>
          ))}
        </select>
      )}

      {/* Month / Year */}
      {hub.filterMode === "month" ? (
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-civic focus:border-civic focus:outline-none focus:ring-2 focus:ring-civic/20"
          defaultValue={selectedMonth ?? ""}
          name="month"
          id="filter-month"
          aria-label="Filter by month"
        >
          <option value="">All Months</option>
          {filters.months.map(({ month }) => (
            <option key={month} value={month}>
              {monthLabel(month)}
            </option>
          ))}
        </select>
      ) : (
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-civic focus:border-civic focus:outline-none focus:ring-2 focus:ring-civic/20"
          defaultValue={selectedYear ?? ""}
          name="year"
          id="filter-year"
          aria-label="Filter by year"
        >
          <option value="">All Years</option>
          {filters.years.map(({ year }) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      )}

      {/* Apply */}
      <button
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-civic px-4 text-sm font-bold text-white shadow-sm transition hover:bg-civic/90 active:scale-[0.98]"
        type="submit"
      >
        <Filter aria-hidden="true" className="h-3.5 w-3.5" />
        Apply
      </button>

      {/* Clear filters */}
      {hasActiveFilter && (
        <a
          href={`/current-affairs/${hub.path}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-muted shadow-sm transition hover:border-berry/50 hover:text-berry"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          Clear
        </a>
      )}

      {/* Active filter chips */}
      {selectedNode && (
        <span className="inline-flex items-center gap-1 rounded-full bg-civic/12 px-3 py-1 text-xs font-bold text-civic">
          {selectedNode.name}
        </span>
      )}
      {selectedMonth && (
        <span className="inline-flex items-center gap-1 rounded-full bg-civic/12 px-3 py-1 text-xs font-bold text-civic">
          {monthLabel(selectedMonth)}
        </span>
      )}
      {selectedYear && (
        <span className="inline-flex items-center gap-1 rounded-full bg-civic/12 px-3 py-1 text-xs font-bold text-civic">
          Year: {selectedYear}
        </span>
      )}
    </form>
  );
}

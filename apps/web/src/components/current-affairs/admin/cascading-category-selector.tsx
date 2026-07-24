"use client";

import { useEffect, useMemo, useState } from "react";
import type { CategoryNode } from "../../../lib/api";

type CascadingCategorySelectorProps = {
  categories: CategoryNode[];
  value: string;
  onChange: (nodeId: string) => void;
  contentFamily: string;
};

export function CascadingCategorySelector({
  categories,
  value,
  onChange,
  contentFamily
}: CascadingCategorySelectorProps) {
  const [selectedGsPaperId, setSelectedGsPaperId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string>("");

  // Filter nodes matching the family and active status
  const familyNodes = useMemo(() => {
    return categories.filter(
      (c) => c.content_family === contentFamily && c.is_active !== false
    );
  }, [categories, contentFamily]);

  const gsPapers = useMemo(() => {
    return familyNodes.filter((c) => c.node_type === "gs_paper");
  }, [familyNodes]);

  const hasGsPapers = gsPapers.length > 0;

  const subjects = useMemo(() => {
    return familyNodes.filter((c) => c.node_type === "subject");
  }, [familyNodes]);

  const topics = useMemo(() => {
    return familyNodes.filter((c) => c.node_type === "topic");
  }, [familyNodes]);

  const subtopics = useMemo(() => {
    return familyNodes.filter((c) => c.node_type === "subtopic");
  }, [familyNodes]);

  // Synchronize internal states with the external value
  useEffect(() => {
    if (!value) {
      setSelectedGsPaperId("");
      setSelectedSubjectId("");
      setSelectedTopicId("");
      setSelectedSubtopicId("");
      return;
    }

    const currentNode = familyNodes.find((c) => String(c.id) === value);
    if (!currentNode) return;

    const resolveGsPaperFor = (subjectId: number | null | undefined) => {
      const parentSubject = subjects.find((s) => s.id === subjectId);
      if (!parentSubject) return;
      const parentPaper = gsPapers.find((g) => g.id === parentSubject.parent_id);
      if (parentPaper) setSelectedGsPaperId(String(parentPaper.id));
    };

    if (currentNode.node_type === "subtopic") {
      setSelectedSubtopicId(String(currentNode.id));
      const parentTopic = topics.find((t) => t.id === currentNode.parent_id);
      if (parentTopic) {
        setSelectedTopicId(String(parentTopic.id));
        const parentSubject = subjects.find((s) => s.id === parentTopic.parent_id);
        if (parentSubject) {
          setSelectedSubjectId(String(parentSubject.id));
          resolveGsPaperFor(parentSubject.id);
        }
      }
    } else if (currentNode.node_type === "topic") {
      setSelectedSubtopicId("");
      setSelectedTopicId(String(currentNode.id));
      const parentSubject = subjects.find((s) => s.id === currentNode.parent_id);
      if (parentSubject) {
        setSelectedSubjectId(String(parentSubject.id));
        resolveGsPaperFor(parentSubject.id);
      }
    } else if (currentNode.node_type === "subject") {
      setSelectedSubtopicId("");
      setSelectedTopicId("");
      setSelectedSubjectId(String(currentNode.id));
      resolveGsPaperFor(currentNode.id);
    } else if (currentNode.node_type === "gs_paper") {
      setSelectedSubtopicId("");
      setSelectedTopicId("");
      setSelectedSubjectId("");
      setSelectedGsPaperId(String(currentNode.id));
    }
  }, [value, familyNodes, gsPapers, subjects, topics, subtopics]);

  // Filter lists based on parent selection
  const activeSubjects = useMemo(() => {
    if (!hasGsPapers) return subjects;
    if (!selectedGsPaperId) return [];
    return subjects.filter((s) => String(s.parent_id) === selectedGsPaperId);
  }, [subjects, hasGsPapers, selectedGsPaperId]);

  const activeTopics = useMemo(() => {
    if (!selectedSubjectId) return [];
    return topics.filter((t) => String(t.parent_id) === selectedSubjectId);
  }, [topics, selectedSubjectId]);

  const activeSubtopics = useMemo(() => {
    if (!selectedTopicId) return [];
    return subtopics.filter((st) => String(st.parent_id) === selectedTopicId);
  }, [subtopics, selectedTopicId]);

  const handleGsPaperChange = (id: string) => {
    setSelectedGsPaperId(id);
    setSelectedSubjectId("");
    setSelectedTopicId("");
    setSelectedSubtopicId("");
    onChange(id);
  };

  const handleSubjectChange = (id: string) => {
    setSelectedSubjectId(id);
    setSelectedTopicId("");
    setSelectedSubtopicId("");
    onChange(id || selectedGsPaperId);
  };

  const handleTopicChange = (id: string) => {
    setSelectedTopicId(id);
    setSelectedSubtopicId("");
    onChange(id || selectedSubjectId);
  };

  const handleSubtopicChange = (id: string) => {
    setSelectedSubtopicId(id);
    onChange(id || selectedTopicId || selectedSubjectId);
  };

  return (
    <div className="grid gap-3">
      {hasGsPapers && (
        <label className="grid gap-1 text-sm font-bold text-ink">
          GS Paper
          <select
            className="h-10 rounded-md border border-line bg-surface px-3 text-sm font-normal outline-none focus:border-civic"
            value={selectedGsPaperId}
            onChange={(e) => handleGsPaperChange(e.target.value)}
          >
            <option value="">-- Select GS Paper --</option>
            {gsPapers.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="grid gap-1 text-sm font-bold text-ink">
        Subject
        <select
          className="h-10 rounded-md border border-line bg-surface px-3 text-sm font-normal outline-none focus:border-civic disabled:opacity-50"
          value={selectedSubjectId}
          onChange={(e) => handleSubjectChange(e.target.value)}
          disabled={hasGsPapers && !selectedGsPaperId}
        >
          <option value="">-- Select Subject --</option>
          {activeSubjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm font-bold text-ink">
        Topic
        <select
          className="h-10 rounded-md border border-line bg-surface px-3 text-sm font-normal outline-none focus:border-civic disabled:opacity-50"
          value={selectedTopicId}
          onChange={(e) => handleTopicChange(e.target.value)}
          disabled={!selectedSubjectId}
        >
          <option value="">-- Select Topic --</option>
          {activeTopics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm font-bold text-ink">
        Subtopic
        <select
          className="h-10 rounded-md border border-line bg-surface px-3 text-sm font-normal outline-none focus:border-civic disabled:opacity-50"
          value={selectedSubtopicId}
          onChange={(e) => handleSubtopicChange(e.target.value)}
          disabled={!selectedTopicId}
        >
          <option value="">-- Select Subtopic --</option>
          {activeSubtopics.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

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
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string>("");

  // Filter nodes matching the family and active status
  const familyNodes = useMemo(() => {
    return categories.filter(
      (c) => c.content_family === contentFamily && c.is_active !== false
    );
  }, [categories, contentFamily]);

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
      setSelectedSubjectId("");
      setSelectedTopicId("");
      setSelectedSubtopicId("");
      return;
    }

    const currentNode = familyNodes.find((c) => String(c.id) === value);
    if (!currentNode) return;

    if (currentNode.node_type === "subtopic") {
      setSelectedSubtopicId(String(currentNode.id));
      const parentTopic = topics.find((t) => t.id === currentNode.parent_id);
      if (parentTopic) {
        setSelectedTopicId(String(parentTopic.id));
        const parentSubject = subjects.find((s) => s.id === parentTopic.parent_id);
        if (parentSubject) {
          setSelectedSubjectId(String(parentSubject.id));
        }
      }
    } else if (currentNode.node_type === "topic") {
      setSelectedSubtopicId("");
      setSelectedTopicId(String(currentNode.id));
      const parentSubject = subjects.find((s) => s.id === currentNode.parent_id);
      if (parentSubject) {
        setSelectedSubjectId(String(parentSubject.id));
      }
    } else if (currentNode.node_type === "subject") {
      setSelectedSubtopicId("");
      setSelectedTopicId("");
      setSelectedSubjectId(String(currentNode.id));
    }
  }, [value, familyNodes, subjects, topics, subtopics]);

  // Filter lists based on parent selection
  const activeTopics = useMemo(() => {
    if (!selectedSubjectId) return [];
    return topics.filter((t) => String(t.parent_id) === selectedSubjectId);
  }, [topics, selectedSubjectId]);

  const activeSubtopics = useMemo(() => {
    if (!selectedTopicId) return [];
    return subtopics.filter((st) => String(st.parent_id) === selectedTopicId);
  }, [subtopics, selectedTopicId]);

  const handleSubjectChange = (id: string) => {
    setSelectedSubjectId(id);
    setSelectedTopicId("");
    setSelectedSubtopicId("");
    onChange(id);
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
    <div className="grid gap-3 md:grid-cols-3">
      <label className="grid gap-1 text-sm font-bold text-ink">
        Subject
        <select
          className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal outline-none focus:border-civic"
          value={selectedSubjectId}
          onChange={(e) => handleSubjectChange(e.target.value)}
        >
          <option value="">-- Select Subject --</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm font-bold text-ink">
        Topic
        <select
          className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal outline-none focus:border-civic disabled:opacity-50"
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
          className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal outline-none focus:border-civic disabled:opacity-50"
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

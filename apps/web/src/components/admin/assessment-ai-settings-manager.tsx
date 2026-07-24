"use client";

import { Brain, Sparkles, BookOpen, Save, Plus, Trash2, CheckCircle2, Loader2, AlertCircle, FileText, ArrowRight, Settings2, RefreshCcw, Edit2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { authenticatedGet, authenticatedPost, authenticatedDelete, useAuth } from "../auth/auth-context";
import { tabStripClass, tabButtonClass } from "../ui/tabs";

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
  prompt: string;
  is_active: boolean;
  input_schema?: any;
  example_input?: string;
  output_schema?: any;
  example_output?: any;
};

type SavedStyleProfile = {
  id: number;
  title: string;
  description?: string;
  tag_level1?: string;
  tag_level2?: string;
  content_type: string;
  style_profile: any;
  example_questions: string[];
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const ASSESSMENT_AI_TYPES = [
  { value: "premium_gk_quiz", label: "Premium GK Quiz" },
  { value: "premium_maths_quiz", label: "Premium Maths Quiz" },
  { value: "premium_passage_quiz", label: "Premium Passage Quiz" },
  { value: "mains_question_generation", label: "Mains Question Generation" },
  { value: "mains_evaluation", label: "Mains Answer AI Evaluation" }
];

const PREDEFINED_SCHEMAS: Record<string, {
  system_instructions: string;
  input_schema: string;
  example_input: string;
  output_schema: string;
  example_output: string;
}> = {
  premium_gk_quiz: {
    system_instructions: "You are an expert in General Knowledge and creating multiple-choice questions for premium users. Your task is to generate Premium GK quiz questions based on the user's input. Each question should have four options (A, B, C, D), with exactly one correct answer. Provide a detailed explanation for the correct answer and brief eliminations for each incorrect option. Include a source reference if applicable. Ensure the output strictly adheres to the provided JSON schema.",
    output_schema: JSON.stringify({
      type: "object",
      properties: {
        question_statement: { type: "string" },
        supp_question_statement: { type: "string", nullable: true },
        statements_facts: { type: "array", items: { type: "string" }, nullable: true },
        question_prompt: { type: "string", nullable: true },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              text: { type: "string" },
              is_correct: { type: "boolean" }
            },
            required: ["label", "text", "is_correct"]
          }
        },
        correct_answer: { type: "string" },
        explanation: { type: "string", nullable: true },
        source_reference: { type: "string", nullable: true }
      },
      required: ["question_statement", "options", "correct_answer"]
    }, null, 2),
    example_output: JSON.stringify({
      question_statement: "Consider the following statements regarding the Indus Valley Civilization (Premium Level):",
      statements_facts: [
        "Statement 1: The civilization was primarily urban.",
        "Statement 2: Iron was a commonly used metal."
      ],
      options: [
        { label: "A", text: "Only Statement 1 is correct", is_correct: true },
        { label: "B", text: "Only Statement 2 is correct", is_correct: false },
        { label: "C", text: "Both Statements 1 and 2 are correct", is_correct: false },
        { label: "D", text: "Neither Statement 1 nor 2 is correct", is_correct: false }
      ],
      correct_answer: "A",
      explanation: "Statement 1 is correct. The Indus Valley Civilization was known for its advanced urban planning. Statement 2 is incorrect. Iron was not used; bronze was the primary metal."
    }, null, 2),
    input_schema: JSON.stringify({
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "The topic for which to generate a Premium GK quiz question."
        },
        difficulty: {
          type: "string",
          enum: ["easy", "medium", "hard", "advanced"],
          description: "The desired difficulty level of the question."
        }
      },
      required: ["topic"]
    }, null, 2),
    example_input: "Generate an advanced difficulty Premium GK quiz question on Ancient Indian History.",
  },
  premium_maths_quiz: {
    system_instructions: "You are an expert in Mathematics and creating multiple-choice questions for premium users. Your task is to generate a Premium Maths quiz question based on the user's input. The question should have four options (A, B, C, D), with exactly one correct answer. Provide a detailed explanation for the correct answer. Use LaTeX delimiters for all formulas: $...$ inline and $$...$$ for display. Include a source reference if applicable. Ensure the output strictly adheres to the provided JSON schema.",
    output_schema: JSON.stringify({
      type: "object",
      properties: {
        question_statement: { type: "string" },
        supp_question_statement: { type: "string", nullable: true },
        statements_facts: { type: "array", items: { type: "string" }, nullable: true },
        question_prompt: { type: "string", nullable: true },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              text: { type: "string" },
              is_correct: { type: "boolean" }
            },
            required: ["label", "text", "is_correct"]
          }
        },
        correct_answer: { type: "string" },
        explanation: { type: "string", nullable: true },
        source_reference: { type: "string", nullable: true }
      },
      required: ["question_statement", "options", "correct_answer"]
    }, null, 2),
    example_output: JSON.stringify({
      question_statement: "A complex number z satisfies |z - 1| = |z + i|. Find the locus of z.",
      options: [
        { label: "A", text: "A circle", is_correct: false },
        { label: "B", text: "A straight line", is_correct: true },
        { label: "C", text: "An ellipse", is_correct: false },
        { label: "D", text: "A parabola", is_correct: false }
      ],
      correct_answer: "B",
      explanation: "The condition $|z-1|=|z+i|$ means the point $z$ is equidistant from $(1,0)$ and $(0,-1)$, so the locus is the perpendicular bisector of the segment joining those points, which is a straight line."
    }, null, 2),
    input_schema: JSON.stringify({
      type: "object",
      properties: {
        problem_description: {
          type: "string",
          description: "A description of the advanced math problem for which to generate a quiz question."
        },
        difficulty: {
          type: "string",
          enum: ["easy", "medium", "hard", "advanced"],
          description: "The desired difficulty level of the question."
        }
      },
      required: ["problem_description"]
    }, null, 2),
    example_input: "Generate an advanced math quiz question about complex numbers.",
  },
  premium_passage_quiz: {
    system_instructions: "You are an expert in reading comprehension and creating multiple-choice questions from a given passage for premium users. Your task is to generate a passage and a set of quiz questions based on the user's input. Each question should have four options (A, B, C, D), with exactly one correct answer. Provide a detailed explanation for the correct answer. Include a source reference for the passage if applicable. Ensure the output strictly adheres to the provided JSON schema.",
    output_schema: JSON.stringify({
      type: "object",
      properties: {
        passage_title: { type: "string", nullable: true },
        passage_text: { type: "string" },
        source_reference: { type: "string", nullable: true },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question_statement: { type: "string" },
              supp_question_statement: { type: "string", nullable: true },
              statements_facts: { type: "array", items: { type: "string" }, nullable: true },
              question_prompt: { type: "string", nullable: true },
              options: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    text: { type: "string" },
                    is_correct: { type: "boolean" }
                  },
                  required: ["label", "text", "is_correct"]
                }
              },
              correct_answer: { type: "string" },
              explanation: { type: "string", nullable: true }
            },
            required: ["question_statement", "options", "correct_answer"]
          }
        }
      },
      required: ["passage_text", "questions"]
    }, null, 2),
    example_output: JSON.stringify({
      passage_title: "The Importance of Renewable Energy",
      passage_text: "Renewable energy sources like solar, wind, and hydro power are crucial for combating climate change. Unlike fossil fuels, they produce little to no greenhouse gas emissions and are naturally replenished.",
      questions: [
        {
          question_statement: "Consider the following statements about renewable energy:",
          statements_facts: [
            "Statement 1: Solar power is a type of renewable energy.",
            "Statement 2: Renewable energy sources are finite."
          ],
          options: [
            { label: "A", text: "Only Statement 1 is correct", is_correct: true },
            { label: "B", text: "Only Statement 2 is correct", is_correct: false },
            { label: "C", text: "Both Statements 1 and 2 are correct", is_correct: false },
            { label: "D", text: "Neither Statement 1 nor 2 is correct", is_correct: false }
          ],
          correct_answer: "A",
          explanation: "Option A (Correct): The passage explicitly lists solar power as a renewable source. Statement 2 is incorrect because the passage notes renewables are naturally replenished, not finite."
        }
      ]
    }, null, 2),
    input_schema: JSON.stringify({
      type: "object",
      properties: {
        passage_topic: {
          type: "string",
          description: "The topic for the premium passage and quiz questions."
        },
        num_questions: {
          type: "integer",
          description: "The number of questions to generate for the passage."
        },
        difficulty: {
          type: "string",
          enum: ["medium", "hard", "advanced"],
          description: "The desired difficulty level of the passage and questions."
        }
      },
      required: ["passage_topic", "num_questions"]
    }, null, 2),
    example_input: "Generate 3 advanced difficulty quiz questions for a passage on 'The Future of Artificial Intelligence'.",
  },
  mains_question_generation: {
    system_instructions: "You are an expert UPSC Mains exam question setter. Your task is to generate high-quality Mains questions based on the provided topic or context. For each question, provide a detailed 'Answer Approach' (structuring the answer) and a comprehensive 'Model Answer'. Focus on critical analysis and multi-dimensional perspectives. Ensure the output strictly adheres to the provided JSON schema.",
    output_schema: JSON.stringify({
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question_text: { type: "string" },
              answer_approach: { type: "string" },
              model_answer: { type: "string" },
              word_limit: { type: "integer" }
            },
            required: ["question_text", "answer_approach", "model_answer"]
          }
        }
      },
      required: ["questions"]
    }, null, 2),
    example_output: JSON.stringify({
      questions: [
        {
          question_text: "Discuss the impact of climate change on Indian agriculture.",
          answer_approach: "**Introduction:** Define climate change and its general impact.\\n**Body:**\\n1. Direct impact on crops (yield, quality).\\n2. Impact on water resources.\\n3. Socio-economic impact on farmers.\\n**Conclusion:** Way forward and government initiatives.",
          model_answer: "Climate change poses a significant threat to Indian agriculture...",
          word_limit: 250
        }
      ]
    }, null, 2),
    input_schema: JSON.stringify({
      type: "object",
      properties: {
        topic: { type: "string" },
        sub_topics: { type: "array", items: { type: "string" } },
        difficulty: { type: "string", enum: ["moderate", "difficult"] }
      },
      required: ["topic"]
    }, null, 2),
    example_input: "Topic: Urbanization in India. Sub-topics: Smart Cities, Slum development."
  },
  mains_evaluation: {
    system_instructions: "You are an expert UPSC Mains answer evaluator. Your task is to evaluate the user's answer based on the provided question and model answer (if available). Provide a score out of 10, detailed feedback, key strengths, areas for improvement, and a refined/improved version of the answer. Be constructive, strict with word limits and relevance, and focus on structure, content, and presentation.",
    output_schema: JSON.stringify({
      type: "object",
      properties: {
        score: { type: "number", description: "Score out of 10" },
        max_score: { type: "number", default: 10 },
        feedback: { type: "string", description: "Detailed evaluation feedback" },
        strengths: { type: "array", items: { type: "string" }, description: "List of strong points in the answer" },
        weaknesses: { type: "array", items: { type: "string" }, description: "List of weak points or areas to improve" },
        improved_answer: { type: "string", description: "A better version of the answer incorporating the feedback" }
      },
      required: ["score", "feedback", "strengths", "weaknesses"]
    }, null, 2),
    example_output: JSON.stringify({
      score: 6.5,
      max_score: 10,
      feedback: "The answer addresses the core demand of the question but lacks specific examples. The introduction is good, but the conclusion is abrupt.",
      strengths: ["Good understanding of the concept", "Clear structure"],
      weaknesses: ["Lack of data/examples", "Conclusion needs improvement"],
      improved_answer: "Revised answer text..."
    }, null, 2),
    input_schema: JSON.stringify({
      type: "object",
      properties: {
        question_text: { type: "string" },
        answer_text: { type: "string" },
        model_answer: { type: "string", nullable: true }
      },
      required: ["question_text", "answer_text"]
    }, null, 2),
    example_input: "Question: Discuss the impact of GST on Indian Economy. Answer: GST has unified the market...",
  }
};

const EXTRACTION_INSTRUCTIONS_QUIZ = `You are a quiz style analyst. Your job is to infer the format, depth, and stylistic patterns from example questions.
Output a JSON object that strictly follows the provided schema. Keep instructions concise and directly usable for generation. Keep the analysis neutral and topic-agnostic. Focus on statement formatting and relations rather than the specific subject.

PRESENTATION FORMAT (MANDATORY): Provide analysis in TWO PARTS for each example:

PART 1 - FULL QUESTION ANALYSIS (overall):
1. Overall structure: e.g., prompt + N statements (independent vs related), or direct question + options.
2. Focus of the question: application vs features vs impacts vs causes vs factual aspects.
3. Topic scope: single-topic vs multi-topic.
4. Difficulty level: solvable from overview vs in-depth single-topic vs comparative knowledge.
5. Relations between components: how statement connects to statements/facts or options.
6. Structural & semantic relation: identify if it asks to define a term, verify statements, etc.
7. Topic cohesion (gap): same section vs different topics/chapters.
8. Incorrect statements/options: identify where wrong options come from (common confusions, reversed causality, wrong pairings) and expected wrong-option patterns.

PART 2 - COMPONENT-WISE ANALYSIS:
1. question_statement: purpose, tone, and how it sets up the analytical task.
2. statements_facts: nature and construction of statements (verbose, factual vs analytical). Statements must stay within the SAME aspect asked.
3. question_prompt: exact phrasing style, placement relative to statements.
4. options: structure, option style, internal consistency, and expected wrong-option patterns.

GLOBAL RULES: Answers should vary; minimize 'all correct' patterns. Incorrect options must be plausible and correct-looking but absolutely incorrect. Explanations must be logical, justified, and add brief extra knowledge.`;

const EXTRACTION_INSTRUCTIONS_EVALUATION = `You are an evaluation style analyst. Your job is to infer the evaluation style, depth, and parameters from example UPSC Mains evaluation feedback.
Output a JSON object that strictly follows the provided schema. Keep instructions concise and directly usable for evaluation.

PRESENTATION FORMAT (MANDATORY): Provide analysis in TWO PARTS for each example:

PART 1 - FULL EVALUATION ANALYSIS (overall):
1. Depth and strictness: lenient vs strict, surface vs detailed.
2. Evaluation parameters emphasized: length, factual accuracy, coverage, diversity, examples/data, structure, directives.
3. Feedback structure: ordering of verdict, intro/body/conclusion checks, and actionability.
4. Missing-points logic: how gaps are identified and how model answers are used.

PART 2 - COMPONENT-WISE ANALYSIS:
1. How introductions, body points, and conclusions are judged.
2. How strengths/weaknesses are framed and justified.
3. How improved answers are constructed (if applicable).

GLOBAL RULES: Produce a combined instruction set that enforces ALL evaluation patterns found. Ensure style_instructions explicitly list evaluation parameters and the missing-points rule.`;

export function AssessmentAiSettingsManager() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<"global" | "profiles">("global");
  const [selectedContentType, setSelectedContentType] = useState<string>("premium_gk_quiz");
  
  // Custom schema mode toggle
  const [useCustomSchema, setUseCustomSchema] = useState<boolean>(false);

  // Editor states (Global Config)
  const [styleGuide, setStyleGuide] = useState<StyleGuideState>({ style_guide: "", source_text: "" });
  const [systemInstructions, setSystemInstructions] = useState<string>("");
  const [inputSchema, setInputSchema] = useState<string>("{}");
  const [exampleInput, setExampleInput] = useState<string>("");
  const [outputSchema, setOutputSchema] = useState<string>("{}");
  const [exampleOutput, setExampleOutput] = useState<string>("{}");

  // UI status states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Style Profile workspace states
  const [styleProfiles, setStyleProfiles] = useState<SavedStyleProfile[]>([]);
  const [profileContentType, setProfileContentType] = useState<string>("premium_gk_quiz");
  const [profileTitle, setProfileTitle] = useState<string>("");
  const [profileDescription, setProfileDescription] = useState<string>("");
  const [profileTag1, setProfileTag1] = useState<string>("");
  const [profileTag2, setProfileTag2] = useState<string>("");
  const [profileExamples, setProfileExamples] = useState<string>("");
  const [extractedProfile, setExtractedProfile] = useState<any>(null);
  const [refineFeedback, setRefineFeedback] = useState<string>("");
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadStyleAndInstructions = useCallback(async (contentType: string) => {
    if (!token) return;
    setLoading(true);
    try {
      // 1. Fetch style guide
      const guide = await authenticatedGet<StyleGuideState>(
        `/api/v1/assessment/admin/ai/style-guide?content_type=${contentType}`,
        token
      );
      setStyleGuide(guide || { style_guide: "", source_text: "" });

      // 2. Fetch instructions and match
      const allInsts = await authenticatedGet<AiInstruction[]>("/api/v1/assessment/admin/ai/instructions", token);
      const match = allInsts?.find(i => i.scope === "quiz" && i.content_type === contentType);

      if (match) {
        setSystemInstructions(match.prompt || "");
        setInputSchema(match.input_schema ? JSON.stringify(match.input_schema, null, 2) : "{}");
        setExampleInput(match.example_input || "");
        setOutputSchema(match.output_schema ? JSON.stringify(match.output_schema, null, 2) : "{}");
        setExampleOutput(match.example_output ? JSON.stringify(match.example_output, null, 2) : "{}");

        // Determine if it matches predefined schemas or is custom
        const predefined = PREDEFINED_SCHEMAS[contentType];
        if (predefined) {
          const outClean = JSON.stringify(match.output_schema, null, 2);
          const outPredefined = JSON.stringify(JSON.parse(predefined.output_schema), null, 2);
          if (outClean === outPredefined) {
            setUseCustomSchema(false);
          } else {
            setUseCustomSchema(true);
          }
        } else {
          setUseCustomSchema(true);
        }
      } else {
        // Fallback to predefined templates
        const predefined = PREDEFINED_SCHEMAS[contentType];
        if (predefined) {
          setSystemInstructions(predefined.system_instructions);
          setInputSchema(predefined.input_schema);
          setExampleInput(predefined.example_input);
          setOutputSchema(predefined.output_schema);
          setExampleOutput(predefined.example_output);
        } else {
          setSystemInstructions("");
          setInputSchema("{}");
          setExampleInput("");
          setOutputSchema("{}");
          setExampleOutput("{}");
        }
        setUseCustomSchema(false);
      }
    } catch (err) {
      console.error("Error loading style & prompt details:", err);
      showMessage("Failed to load details for selection", "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadStyleProfiles = useCallback(async () => {
    if (!token) return;
    try {
      const records = await authenticatedGet<SavedStyleProfile[]>(
        "/api/v1/assessment/admin/ai/style-profiles",
        token
      );
      setStyleProfiles(records || []);
    } catch (err) {
      console.error("Error loading style profiles:", err);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "global") {
      void loadStyleAndInstructions(selectedContentType);
    } else {
      void loadStyleProfiles();
    }
  }, [selectedContentType, activeTab, loadStyleAndInstructions, loadStyleProfiles]);

  // Effect to handle content type change and populate schemas when NOT in custom schema mode
  useEffect(() => {
    if (!useCustomSchema && activeTab === "global") {
      const predefined = PREDEFINED_SCHEMAS[selectedContentType];
      if (predefined) {
        setInputSchema(predefined.input_schema);
        setExampleInput(predefined.example_input);
        setOutputSchema(predefined.output_schema);
        setExampleOutput(predefined.example_output);
      }
    }
  }, [selectedContentType, useCustomSchema, activeTab]);

  const handleSaveSettings = async () => {
    if (!token) return;
    
    // JSON schema validations
    try {
      JSON.parse(inputSchema);
      JSON.parse(outputSchema);
      JSON.parse(exampleOutput);
    } catch (e) {
      showMessage("Invalid JSON schema format in input schema, output schema, or example output.", "error");
      return;
    }

    setSaving(true);
    try {
      // 1. Save style guide
      await authenticatedPost("/api/v1/assessment/admin/ai/style-guide", token, {
        style_guide: styleGuide.style_guide,
        source_text: styleGuide.source_text || null,
        content_type: selectedContentType
      });

      // 2. Save prompt
      await authenticatedPost("/api/v1/assessment/admin/ai/instructions", token, {
        scope: "quiz",
        title: `${selectedContentType.toUpperCase().replace(/_/g, " ")} Generation Template`,
        content_type: selectedContentType,
        prompt: systemInstructions,
        input_schema: JSON.parse(inputSchema),
        example_input: exampleInput || null,
        output_schema: JSON.parse(outputSchema),
        example_output: JSON.parse(exampleOutput),
        is_active: true
      });

      showMessage("Premium settings and templates updated successfully!");
      await loadStyleAndInstructions(selectedContentType);
    } catch (err) {
      showMessage("Failed to save style configurations", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyzeStyle = async () => {
    if (!token) return;
    if (!styleGuide.source_text?.trim()) {
      showMessage("Please paste some reference text to analyze", "error");
      return;
    }
    
    setSaving(true);
    try {
      const res = await authenticatedPost<{ style_guide: string }>(
        "/api/v1/assessment/admin/ai/extract-style",
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

  // ── STYLE PROFILE METHODS ──
  const handleExtractProfile = async () => {
    if (!token) return;
    if (!profileExamples.trim()) {
      showMessage("Please add example questions or evaluations to analyze.", "error");
      return;
    }

    setSaving(true);
    try {
      const examples = profileExamples.split("\n\n").map(q => q.trim()).filter(Boolean);
      const res = await authenticatedPost<{ style_profile: any }>(
        "/api/v1/assessment/admin/ai/style-profiles/extract",
        token,
        {
          content_type: profileContentType,
          example_questions: examples
        }
      );
      if (res && res.style_profile) {
        setExtractedProfile(res.style_profile);
        showMessage("Style profile extracted successfully! Check the results below.");
      } else {
        throw new Error("Empty style profile returned.");
      }
    } catch (err: any) {
      console.error("Style extraction failed:", err);
      showMessage("Extraction failed: " + (err.message || err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRefineProfile = async () => {
    if (!token || !extractedProfile || !refineFeedback.trim()) return;

    setSaving(true);
    try {
      const res = await authenticatedPost<{ style_profile: any }>(
        "/api/v1/assessment/admin/ai/style-profiles/refine",
        token,
        {
          content_type: profileContentType,
          style_profile: extractedProfile,
          feedback: refineFeedback
        }
      );
      if (res && res.style_profile) {
        setExtractedProfile(res.style_profile);
        setRefineFeedback("");
        showMessage("Style profile refined successfully!");
      }
    } catch (err: any) {
      console.error("Refinement failed:", err);
      showMessage("Refinement failed: " + (err.message || err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!token || !extractedProfile) return;
    if (!profileTitle.trim()) {
      showMessage("Profile title is required.", "error");
      return;
    }

    setSaving(true);
    try {
      const examples = profileExamples.split("\n\n").map(q => q.trim()).filter(Boolean);
      const tags = [profileTag1, profileTag2].map(t => t.trim()).filter(Boolean);
      
      const payload = {
        title: profileTitle.trim(),
        description: profileDescription.trim() || undefined,
        tag_level1: profileTag1.trim() || undefined,
        tag_level2: profileTag2.trim() || undefined,
        content_type: profileContentType,
        style_profile: extractedProfile,
        example_questions: examples,
        tags,
        is_active: true
      };

      if (editingProfileId) {
        await authenticatedPost(`/api/v1/assessment/admin/ai/style-profiles/${editingProfileId}`, token, {
          ...payload,
          _method: "PUT" // standard framework fallback if PUT routes aren't natively supported, or use direct fetcher
        });
        // We'll call the direct PUT route via endpoint if post fails or just directly fetch it
        try {
          // Attempt standard JSON fetcher
          await fetch(`/api/v1/assessment/admin/ai/style-profiles/${editingProfileId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
        } catch {}
        showMessage("Style profile updated successfully!");
      } else {
        await authenticatedPost("/api/v1/assessment/admin/ai/style-profiles", token, payload);
        showMessage("Style profile saved successfully!");
      }

      // Reset workspace
      setProfileTitle("");
      setProfileDescription("");
      setProfileTag1("");
      setProfileTag2("");
      setProfileExamples("");
      setExtractedProfile(null);
      setEditingProfileId(null);
      
      await loadStyleProfiles();
    } catch (err: any) {
      console.error("Saving failed:", err);
      showMessage("Failed to save style profile: " + (err.message || err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEditProfile = (profile: SavedStyleProfile) => {
    setEditingProfileId(profile.id);
    setProfileTitle(profile.title);
    setProfileDescription(profile.description || "");
    setProfileTag1(profile.tag_level1 || "");
    setProfileTag2(profile.tag_level2 || "");
    setProfileContentType(profile.content_type);
    setProfileExamples(profile.example_questions.join("\n\n"));
    setExtractedProfile(profile.style_profile);
    showMessage(`Loaded "${profile.title}" into workspace.`);
  };

  const handleDeleteProfile = async (id: number) => {
    if (!token || !window.confirm("Are you sure you want to delete this style profile?")) return;
    try {
      // standard DELETE
      await fetch(`/api/v1/assessment/admin/ai/style-profiles/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      showMessage("Style profile deleted successfully!");
      await loadStyleProfiles();
    } catch (err) {
      console.error("Failed to delete profile:", err);
      showMessage("Failed to delete style profile", "error");
    }
  };

  return (
    <div className="bg-surface border border-line rounded-2xl shadow-sm overflow-hidden font-sans">
      {/* Tab Selectors */}
      <div className="border-b border-line bg-slate-50/50 p-3">
        <div className={tabStripClass()}>
          <button onClick={() => setActiveTab("global")} className={tabButtonClass(activeTab === "global")}>
            <Settings2 className="h-4 w-4" />
            Global Config & Templates
          </button>
          <button onClick={() => setActiveTab("profiles")} className={tabButtonClass(activeTab === "profiles")}>
            <Sparkles className="h-4 w-4" />
            Style Profiles (Example Analyses)
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
          <span className="text-sm font-semibold">Loading configurations...</span>
        </div>
      ) : activeTab === "global" ? (
        /* ── GLOBAL CONFIG VIEW ── */
        <div className="p-6 space-y-8 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <h3 className="text-lg font-black text-ink">Global AI Settings & Schemas</h3>
              <p className="text-xs text-ink/65 mt-1">
                Configure primary prompt instructions and expected input/output JSON parameters for each assessment type.
              </p>
            </div>
            
            <label className="flex items-center gap-2 text-xs font-black text-ink shrink-0">
              Target Mode:
              <select
                value={selectedContentType}
                onChange={(e) => setSelectedContentType(e.target.value)}
                className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-civic outline-none focus:border-civic"
              >
                {ASSESSMENT_AI_TYPES.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column: Style Guide & Extractor */}
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-civic tracking-wide uppercase">Writing Rules</span>
                  <h4 className="text-sm font-black text-ink">Global Style Guide Constraints (Markdown)</h4>
                  <p className="text-[11px] text-ink/50 leading-tight">Fallback instructions guiding formatting, tone, and equations.</p>
                </div>
                
                <textarea
                  value={styleGuide.style_guide || ""}
                  onChange={(e) => setStyleGuide(prev => ({ ...prev, style_guide: e.target.value }))}
                  placeholder="e.g. Write in a neutral tone. Use high difficulty vocabulary. LaTeX formatting is mandatory for expressions."
                  className="w-full min-h-[160px] rounded-xl border border-line p-4 text-sm font-mono leading-relaxed outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all resize-y"
                />
              </div>

              {/* Scrape text extractor */}
              <div className="border border-line rounded-xl p-4 bg-paper/20 space-y-3">
                <label className="block text-xs font-bold text-ink">
                  Extract Base Guidelines from Reference
                  <textarea
                    value={styleGuide.source_text || ""}
                    onChange={(e) => setStyleGuide(prev => ({ ...prev, source_text: e.target.value }))}
                    placeholder="Paste reference text here..."
                    className="w-full min-h-[100px] mt-1.5 rounded-lg border border-line p-3 text-xs bg-surface outline-none focus:border-civic transition-all"
                  />
                </label>
                <button
                  onClick={handleAnalyzeStyle}
                  disabled={saving || !styleGuide.source_text?.trim()}
                  className="inline-flex items-center gap-2 px-3 h-8 border border-civic text-civic hover:bg-civic/5 font-bold rounded-lg text-[10px] transition-all active:scale-[0.98] disabled:opacity-55 touch-manipulation"
                  type="button"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Extract Base Style
                </button>
              </div>
            </div>

            {/* Right Column: System Instructions */}
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-civic tracking-wide uppercase">Instructions Prompt</span>
                <h4 className="text-sm font-black text-ink">AI Primary Instructions Prompt</h4>
                <p className="text-[11px] text-ink/50 leading-tight">The primary prompt instructing the AI how to generate items or evaluate copies.</p>
              </div>

              <textarea
                value={systemInstructions || ""}
                onChange={(e) => setSystemInstructions(e.target.value)}
                placeholder="Write system instructions..."
                className="w-full min-h-[345px] rounded-xl border border-line p-4 text-sm font-mono leading-relaxed outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all resize-y"
              />
            </div>
          </div>

          {/* Input & Output Schemas */}
          <div className="border-t border-line/60 pt-6 space-y-6">
            <div>
              <h4 className="text-sm font-black text-ink">JSON Schemas Configuration</h4>
              <p className="text-[11px] text-ink/50 mt-1">Specify expected JSON inputs and validation rules for structured AI generations.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Input Schema */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-ink">
                  Input JSON Schema
                  <textarea
                    value={inputSchema}
                    onChange={(e) => setInputSchema(e.target.value)}
                    className="w-full min-h-[140px] mt-1.5 rounded-xl border border-line p-3 text-xs bg-surface font-mono outline-none focus:border-civic transition-all"
                  />
                </label>
                <label className="block text-xs font-bold text-ink">
                  Example Input
                  <input
                    type="text"
                    value={exampleInput}
                    onChange={(e) => setExampleInput(e.target.value)}
                    className="w-full h-10 mt-1.5 rounded-xl border border-line px-3 text-xs bg-surface outline-none focus:border-civic transition-all"
                    placeholder="Provide an example input parameter..."
                  />
                </label>
              </div>

              {/* Output Schema */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="checkbox"
                    id="useCustomSchema"
                    checked={useCustomSchema}
                    onChange={(e) => setUseCustomSchema(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-civic focus:ring-civic"
                  />
                  <label htmlFor="useCustomSchema" className="text-xs font-bold text-ink select-none cursor-pointer">
                    Use Custom Output Schema
                  </label>
                </div>
                
                <label className="block text-xs font-bold text-ink">
                  Output JSON Schema
                  <textarea
                    value={outputSchema}
                    onChange={(e) => setOutputSchema(e.target.value)}
                    disabled={!useCustomSchema}
                    className={`w-full min-h-[160px] mt-1.5 rounded-xl border border-line p-3 text-xs font-mono outline-none focus:border-civic transition-all ${
                      !useCustomSchema ? "bg-paper/50 cursor-not-allowed text-ink/40" : "bg-surface"
                    }`}
                  />
                </label>
                <label className="block text-xs font-bold text-ink">
                  Example Output JSON
                  <textarea
                    value={exampleOutput}
                    onChange={(e) => setExampleOutput(e.target.value)}
                    disabled={!useCustomSchema}
                    className={`w-full min-h-[160px] mt-1.5 rounded-xl border border-line p-3 text-xs font-mono outline-none focus:border-civic transition-all ${
                      !useCustomSchema ? "bg-paper/50 cursor-not-allowed text-ink/40" : "bg-surface"
                    }`}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex justify-end pt-4 border-t border-line">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-civic text-white font-bold text-sm shadow-md hover:bg-civic/90 transition-all active:scale-[0.98] disabled:opacity-55"
              type="button"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Global AI settings
            </button>
          </div>
        </div>
      ) : (
        /* ── STYLE PROFILES VIEW ── */
        <div className="p-6 space-y-8 animate-in fade-in duration-200">
          <div>
            <h3 className="text-lg font-black text-ink">Assessment Quiz Style Profiles</h3>
            <p className="text-xs text-ink/65 mt-1">
              Create, refine, and manage multiple style profiles derived from raw example questions or subjective tests. Select these profiles during quiz creation to enforce strict styling.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.5fr_2.5fr]">
            {/* Left Column: Style Profiles Ingestion & Saved Profiles */}
            <div className="space-y-6">
              {/* Existing profiles list */}
              <div className="bg-slate-50/50 border border-line rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-black text-ink uppercase tracking-wider">Saved Style Profiles ({styleProfiles.length})</h4>
                
                {styleProfiles.length === 0 ? (
                  <p className="text-xs text-ink/50 italic py-4">No style profiles configured yet. Extract one below.</p>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {styleProfiles.map(p => (
                      <div key={p.id} className="bg-surface border border-line rounded-xl p-3.5 shadow-sm space-y-2 flex flex-col justify-between hover:border-civic/50 transition-colors">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-sm text-ink truncate">{p.title}</span>
                            <span className="text-[9px] font-black bg-civic/10 text-civic px-2 py-0.5 rounded-full uppercase shrink-0">
                              {p.content_type.replace(/_/g, " ")}
                            </span>
                          </div>
                          {p.description && <p className="text-[11px] text-ink/60 line-clamp-2 mt-1">{p.description}</p>}
                          {p.tags && p.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {p.tags.map((t, idx) => (
                                <span key={idx} className="text-[9px] font-bold text-ink/55 bg-slate-100 px-1.5 py-0.5 rounded">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 border-t border-slate-100 pt-2 justify-end">
                          <button
                            onClick={() => handleEditProfile(p)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-civic hover:underline"
                            type="button"
                          >
                            <Edit2 className="h-3 w-3" />
                            Load/Refine
                          </button>
                          <button
                            onClick={() => handleDeleteProfile(p.id)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-berry hover:underline ml-2"
                            type="button"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Extraction Ingestion workspace */}
              <div className="bg-surface border border-line rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-black text-ink uppercase tracking-wider flex items-center gap-2">
                  <Brain className="h-4.5 w-4.5 text-civic" />
                  {editingProfileId ? "Edit Style Profile Workspace" : "New Style Profile Extraction"}
                </h4>
                
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-ink">
                    Target Quiz/Content Type:
                    <select
                      value={profileContentType}
                      onChange={(e) => setProfileContentType(e.target.value)}
                      disabled={saving}
                      className="w-full h-10 mt-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-semibold outline-none focus:border-civic"
                    >
                      {ASSESSMENT_AI_TYPES.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                  </label>

                  <label className="block text-xs font-bold text-ink">
                    Reference Example Questions / Evaluator Feedbacks
                    <p className="text-[10px] text-ink/40 font-normal mt-0.5">Paste 2-3 detailed examples. Separate distinct examples with double newlines.</p>
                    <textarea
                      value={profileExamples}
                      onChange={(e) => setProfileExamples(e.target.value)}
                      disabled={saving}
                      placeholder="Q1. Consider the following statements...&#10;1. statement A...&#10;2. statement B...&#10;&#10;Q2. Which of the following is correct..."
                      className="w-full min-h-[220px] mt-1.5 rounded-xl border border-line p-3 text-xs bg-surface outline-none focus:border-civic font-mono"
                    />
                  </label>

                  <div className="flex gap-2">
                    <button
                      onClick={handleExtractProfile}
                      disabled={saving || !profileExamples.trim()}
                      className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-civic text-white font-bold text-xs shadow-sm hover:bg-civic/90 active:scale-[0.98] transition-all disabled:opacity-55"
                      type="button"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {editingProfileId ? "Re-Extract Style" : "Extract Style Profile"}
                    </button>
                    {editingProfileId && (
                      <button
                        onClick={() => {
                          setEditingProfileId(null);
                          setProfileTitle("");
                          setProfileDescription("");
                          setProfileTag1("");
                          setProfileTag2("");
                          setProfileExamples("");
                          setExtractedProfile(null);
                        }}
                        className="h-11 px-4 rounded-xl border border-line font-bold text-xs text-ink/60 hover:bg-slate-50"
                        type="button"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                  
                  {/* Collapsible Guidelines Box */}
                  <details className="border border-line rounded-xl p-3 bg-slate-50/50 space-y-2 mt-4 text-xs">
                    <summary className="font-extrabold text-ink/75 cursor-pointer select-none flex items-center gap-1.5 hover:text-civic transition-colors">
                      <Brain className="h-3.5 w-3.5 text-civic animate-pulse" />
                      View AI Extraction Prompt Instructions
                    </summary>
                    <div className="mt-2 text-ink/80 leading-relaxed max-h-[220px] overflow-y-auto font-mono text-[10px] whitespace-pre-wrap bg-surface border border-line p-3 rounded-lg">
                      {profileContentType === "mains_evaluation" ? EXTRACTION_INSTRUCTIONS_EVALUATION : EXTRACTION_INSTRUCTIONS_QUIZ}
                    </div>
                  </details>
                </div>
              </div>
            </div>

            {/* Right Column: Style Profile Results, Refinements, and Save form */}
            <div className="space-y-6">
              {!extractedProfile ? (
                <div className="border border-dashed border-line rounded-2xl p-12 flex flex-col items-center justify-center text-center text-ink/40 space-y-2 min-h-[400px]">
                  <FileText className="h-8 w-8 text-ink/20" />
                  <p className="text-sm font-bold">No Extracted Style Profile Loaded</p>
                  <p className="text-xs max-w-xs leading-normal">
                    Select a saved profile to edit or paste example questions on the left to extract their formatting structure.
                  </p>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Extracted Profile Details Card */}
                  <div className="bg-surface border border-line rounded-2xl p-6 space-y-4">
                    <h4 className="text-xs font-black text-ink uppercase tracking-wider">Extracted Style profile Analysis</h4>
                    
                    <div className="space-y-3.5 text-sm">
                      <div className="grid grid-cols-[110px_1fr] gap-2 border-b border-slate-100 pb-2">
                        <span className="font-bold text-xs text-ink/50">Summary:</span>
                        <span className="text-ink font-medium">{extractedProfile.summary || "N/A"}</span>
                      </div>
                      
                      <div className="grid grid-cols-[110px_1fr] gap-2 border-b border-slate-100 pb-2">
                        <span className="font-bold text-xs text-ink/50">Difficulty / Strictness:</span>
                        <span className="text-ink font-medium capitalize">{extractedProfile.difficulty || "N/A"}</span>
                      </div>

                      <div className="grid grid-cols-[110px_1fr] gap-2 border-b border-slate-100 pb-2">
                        <span className="font-bold text-xs text-ink/50">Style Rules:</span>
                        <span className="text-ink leading-relaxed font-medium">{extractedProfile.style_instructions || "N/A"}</span>
                      </div>

                      {extractedProfile.format_rules && extractedProfile.format_rules.length > 0 && (
                        <div className="grid grid-cols-[110px_1fr] gap-2 border-b border-slate-100 pb-2">
                          <span className="font-bold text-xs text-ink/50">Format Rules:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-xs text-ink/80 font-medium">
                            {extractedProfile.format_rules.map((r: string, idx: number) => (
                              <li key={idx}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {extractedProfile.dos && extractedProfile.dos.length > 0 && (
                        <div className="grid grid-cols-[110px_1fr] gap-2 border-b border-slate-100 pb-2">
                          <span className="font-bold text-xs text-ink/50">Dos:</span>
                          <div className="flex flex-wrap gap-1">
                            {extractedProfile.dos.map((d: string, idx: number) => (
                              <span key={idx} className="text-[11px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded font-medium">{d}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {extractedProfile.donts && extractedProfile.donts.length > 0 && (
                        <div className="grid grid-cols-[110px_1fr] gap-2 border-b border-slate-100 pb-2">
                          <span className="font-bold text-xs text-ink/50">Donts:</span>
                          <div className="flex flex-wrap gap-1">
                            {extractedProfile.donts.map((d: string, idx: number) => (
                              <span key={idx} className="text-[11px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded font-medium">{d}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Example Analysis accordion list */}
                    {extractedProfile.example_analyses && extractedProfile.example_analyses.length > 0 && (
                      <div className="border border-line rounded-xl p-3 bg-slate-50 space-y-2 mt-4">
                        <span className="text-[11px] font-black text-ink/65 uppercase tracking-wider">Example Breakdown Details ({extractedProfile.example_analyses.length})</span>
                        <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1">
                          {extractedProfile.example_analyses.map((e: any, idx: number) => (
                            <div key={idx} className="bg-surface border border-line rounded-lg p-3 text-xs space-y-1.5">
                              <div className="flex justify-between items-center font-bold">
                                <span className="text-civic">Example #{e.index || idx + 1}</span>
                                <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded uppercase">{e.format || e.nature || "Standard"}</span>
                              </div>
                              {e.depth && <div><span className="font-bold text-ink/50">Depth:</span> {e.depth}</div>}
                              {e.reasoning_pattern && <div><span className="font-bold text-ink/50">Reasoning Pattern:</span> {e.reasoning_pattern}</div>}
                              {e.option_pattern && <div><span className="font-bold text-ink/50">Option Pattern:</span> {e.option_pattern}</div>}
                              {e.explanation_expectations && <div><span className="font-bold text-ink/50">Explanation Expectation:</span> {e.explanation_expectations}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Refinement feedback box */}
                  <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-black text-ink uppercase tracking-wider">Refine Style Analysis with Feedback</h4>
                    <p className="text-[10px] text-ink/50 leading-tight">If the extracted instructions lack detail or got certain rules wrong, type your feedback to re-train the style guidelines.</p>
                    <textarea
                      value={refineFeedback}
                      onChange={(e) => setRefineFeedback(e.target.value)}
                      placeholder="e.g. Ensure we don't use 'All of the above' options. Make incorrect statements reverse cause-and-effect."
                      className="w-full min-h-[80px] rounded-lg border border-line p-3 text-xs outline-none focus:border-civic"
                    />
                    <button
                      onClick={handleRefineProfile}
                      disabled={saving || !refineFeedback.trim()}
                      className="inline-flex items-center gap-1.5 h-8 px-4 border border-civic text-civic hover:bg-civic/5 font-bold rounded-lg text-[10px] transition-all"
                      type="button"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                      Refine Guidelines
                    </button>
                  </div>

                  {/* Save profile form */}
                  <div className="bg-surface border border-line rounded-2xl p-6 space-y-4">
                    <h4 className="text-xs font-black text-ink uppercase tracking-wider">Save Reusable Style Profile</h4>
                    
                    <div className="space-y-4">
                      <label className="block text-xs font-bold text-ink">
                        Profile Title:
                        <input
                          type="text"
                          value={profileTitle}
                          onChange={(e) => setProfileTitle(e.target.value)}
                          placeholder="e.g. UPSC Prelims Economy Statements (Strict)"
                          className="w-full h-10 mt-1.5 rounded-xl border border-line px-3 text-xs bg-surface outline-none focus:border-civic"
                        />
                      </label>

                      <label className="block text-xs font-bold text-ink">
                        Profile Description:
                        <input
                          type="text"
                          value={profileDescription}
                          onChange={(e) => setProfileDescription(e.target.value)}
                          placeholder="Brief description of when to use this style guide..."
                          className="w-full h-10 mt-1.5 rounded-xl border border-line px-3 text-xs bg-surface outline-none focus:border-civic"
                        />
                      </label>

                      <div className="grid gap-4 grid-cols-2">
                        <label className="block text-xs font-bold text-ink">
                          Tag level 1 (Subject):
                          <input
                            type="text"
                            value={profileTag1}
                            onChange={(e) => setProfileTag1(e.target.value)}
                            placeholder="e.g. Economy"
                            className="w-full h-10 mt-1.5 rounded-xl border border-line px-3 text-xs bg-surface outline-none focus:border-civic"
                          />
                        </label>
                        <label className="block text-xs font-bold text-ink">
                          Tag level 2 (Topic):
                          <input
                            type="text"
                            value={profileTag2}
                            onChange={(e) => setProfileTag2(e.target.value)}
                            placeholder="e.g. Banking"
                            className="w-full h-10 mt-1.5 rounded-xl border border-line px-3 text-xs bg-surface outline-none focus:border-civic"
                          />
                        </label>
                      </div>

                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-civic text-white font-bold text-sm shadow-md hover:bg-civic/90 transition-all"
                        type="button"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {editingProfileId ? "Update Style Profile" : "Save Style Profile"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

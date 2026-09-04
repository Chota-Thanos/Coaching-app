"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Send, Sparkles, Square, Volume2, VolumeX } from "lucide-react";
import { ApiError, authenticatedPost, useAuth } from "../auth/auth-context";
import { CapReachedNotice, isCapError } from "../billing/cap-reached-notice";
import { useStartTest } from "../../lib/use-start-test";

/**
 * The AI performance coach.
 *
 * The performance page has always been able to show a student WHAT their
 * accuracy is. This is the part that can say why: the endpoint behind it reads
 * the actual questions they got wrong, including the option they picked and
 * how long they took, and answers from that evidence rather than from generic
 * advice.
 *
 * Voice is the browser's own. SpeechRecognition and speechSynthesis cost
 * nothing, need no key and no upload, and degrade honestly — where recognition
 * is missing (Firefox, and older Safari) the mic button simply does not
 * appear, and typing works exactly as before. That seemed a better trade than
 * shipping an audio-upload pipeline for a feature most students will type into
 * anyway.
 */

type CoachAction = {
  kind: "start_practice_test";
  label: string;
  reason: string;
  taxonomy_node_id: number | null;
  question_count: number;
};

type CoachResponse = {
  reply: string;
  actions: CoachAction[];
  used_tools: string[];
};

type Turn = { role: "user" | "assistant"; content: string; actions?: CoachAction[] };

const STARTERS = [
  "What mistakes do I keep making?",
  "Which topic is costing me the most marks?",
  "Am I rushing or overthinking?"
];

/** A result page is a different question: it is about the paper just sat. */
const RESULT_STARTERS = [
  "Why did I get these wrong?",
  "What should I revise from this test?",
  "Did I lose marks to time or to knowledge?"
];

/** Chrome and Edge expose this prefixed; nothing else reliably has it. */
function getSpeechRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function PerformanceCoachPanel({
  contentType,
  examId,
  taxonomyNodeId,
  topicName,
  attemptId,
  attemptSource = "assessment"
}: {
  contentType: "gk" | "aptitude" | "mains";
  /** Needed to start the practice the coach recommends, same as StartTestPill. */
  examId: number | null;
  taxonomyNodeId?: number | null;
  topicName?: string;
  /** On a result page: the attempt being reviewed, so "this test" resolves. */
  attemptId?: number | null;
  /** Study-plan attempts live in their own tables; custom tests do not. */
  attemptSource?: "assessment" | "study_plan";
}) {
  const { token } = useAuth();
  const { start: startTest, starting } = useStartTest();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capError, setCapError] = useState<ApiError | null>(null);
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const recognitionRef = useRef<any>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);

  useEffect(() => {
    setVoiceSupported(Boolean(getSpeechRecognition()));
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [turns, busy]);

  // Anything still being spoken when the panel goes away must be stopped, or
  // it carries on talking over the next page.
  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
        recognitionRef.current?.stop?.();
      } catch {
        // Nothing to release.
      }
    };
  }, []);

  const speak = (text: string) => {
    if (!speakReplies || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    try {
      window.speechSynthesis?.cancel();
    } finally {
      setSpeaking(false);
    }
  };

  const toggleListening = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;

    // Interim results land in the box as they arrive, so a student can see it
    // is hearing them rather than staring at a dead button.
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setDraft(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  };

  async function ask(question?: string): Promise<void> {
    const message = (question ?? draft).trim();
    if (!token || !message || busy) return;

    recognitionRef.current?.stop?.();
    setListening(false);
    stopSpeaking();

    const history = turns.map((turn) => ({ role: turn.role, content: turn.content }));
    setTurns((current) => [...current, { role: "user", content: message }]);
    setDraft("");
    setBusy(true);
    setError(null);
    setCapError(null);

    try {
      const response = await authenticatedPost<CoachResponse>(
        "/api/v1/assessment/me/performance-coach",
        token,
        {
          message,
          content_type: contentType,
          taxonomy_node_id: taxonomyNodeId ?? undefined,
          attempt_id: attemptId ?? undefined,
          attempt_source: attemptSource,
          history
        }
      );
      setTurns((current) => [
        ...current,
        { role: "assistant", content: response.reply, actions: response.actions ?? [] }
      ]);
      speak(response.reply);
    } catch (caught) {
      if (isCapError(caught)) setCapError(caught as ApiError);
      else setError(caught instanceof Error ? caught.message : "The coach could not answer that.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Practice is proposed, never started behind the student's back — the coach
   * returns the recommendation and this button is what actually starts a
   * timed attempt.
   */
  const runAction = async (action: CoachAction) => {
    const nodeId = action.taxonomy_node_id ?? taxonomyNodeId;
    if (!examId || !nodeId) return;
    await startTest(
      examId,
      [
        {
          subject_node_id: nodeId,
          source_node_id: null,
          topic_node_id: null,
          subtopic_node_id: null,
          question_count: action.question_count
        }
      ],
      { title: action.label }
    );
  };

  return (
    <section className="rounded-xl border border-civic/25 bg-civic/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-civic" />
          <div>
            <p className="text-sm font-black text-ink">Ask about your performance</p>
            <p className="mt-0.5 text-xs font-semibold text-ink/55">
              {attemptId
                ? "Reads this paper question by question — what you picked, and where the time went."
                : `Reads your actual attempts — the questions you got wrong and what you picked${topicName ? ` in ${topicName}` : ""}.`}
            </p>
          </div>
        </div>
        <button
          className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-black ${
            speakReplies ? "border-civic bg-civic text-white" : "border-line bg-surface text-ink/60"
          }`}
          onClick={() => {
            if (speakReplies) stopSpeaking();
            setSpeakReplies((value) => !value);
          }}
          type="button"
        >
          {speakReplies ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          Read answers aloud
        </button>
      </div>

      {turns.length > 0 && (
        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-lg border border-line bg-surface p-3" ref={listRef}>
          {turns.map((turn, index) => (
            <div key={index}>
              <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">
                {turn.role === "user" ? "You" : "Coach"}
              </p>
              <p
                className={`mt-1 whitespace-pre-wrap text-xs leading-5 ${
                  turn.role === "user" ? "text-ink/70" : "font-semibold text-ink"
                }`}
              >
                {turn.content}
              </p>
              {(examId ? turn.actions ?? [] : []).map((action, actionIndex) => (
                <button
                  className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-md bg-civic px-3 text-[11px] font-black text-white disabled:opacity-60"
                  disabled={starting}
                  key={actionIndex}
                  onClick={() => void runAction(action)}
                  title={action.reason}
                  type="button"
                >
                  {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {action.label} · {action.question_count} questions
                </button>
              ))}
            </div>
          ))}
          {busy && (
            <p className="inline-flex items-center gap-2 text-xs font-bold text-ink/45">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Reading your attempts…
            </p>
          )}
        </div>
      )}

      {turns.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(attemptId ? RESULT_STARTERS : STARTERS).map((starter) => (
            <button
              className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-bold text-ink/70 hover:border-civic hover:text-civic"
              key={starter}
              onClick={() => void ask(starter)}
              type="button"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      {capError && (
        <div className="mt-3">
          <CapReachedNotice compact error={capError} module="self_preparation" />
        </div>
      )}
      {error && <p className="mt-3 text-xs font-bold text-berry">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        {voiceSupported && (
          <button
            aria-label={listening ? "Stop listening" : "Ask by voice"}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border ${
              listening ? "border-rose-300 bg-rose-50 text-rose-600" : "border-line bg-surface text-ink/60"
            }`}
            onClick={toggleListening}
            title={listening ? "Stop listening" : "Ask by voice"}
            type="button"
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
        <input
          className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-xs font-semibold text-ink outline-none focus:border-civic"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void ask();
            }
          }}
          placeholder={listening ? "Listening…" : "Ask about your mistakes, timing or weak topics"}
          value={draft}
        />
        {speaking ? (
          <button
            aria-label="Stop reading"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-surface text-ink/60"
            onClick={stopSpeaking}
            type="button"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          aria-label="Ask"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-civic text-white disabled:opacity-50"
          disabled={busy || !draft.trim()}
          onClick={() => void ask()}
          type="button"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </section>
  );
}

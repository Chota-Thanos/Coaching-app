"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authenticatedGet, useAuth } from "../auth/auth-context";
import { browserBaseUrl } from "../../lib/api";
import {
  PLAN_TYPE_CLASS,
  PLAN_TYPE_LABEL,
  studyPlanHref,
  type StudyPlanDetail,
  type StudyPlanItem,
  type StudyPlanItemResource
} from "../../lib/study-plans";

/**
 * One day of a plan, opened.
 *
 * Three shapes behind one route, because the three plan types put different
 * things on a day: a reading day is its resource list, a lecture day is its
 * player, and a test day hands off to the existing attempt engine. The
 * discussion thread a test-series day would carry is designed but not built —
 * it is stubbed here rather than pretended away.
 *
 * Time on task is recorded while the page is open. That is not analytics for
 * its own sake: the tracker's depth signal is what catches a 45-minute reading
 * closed in ninety seconds, and it needs a real number to do it.
 */

const TEST_TYPES = new Set(["prelims_test", "csat_test", "mains_test"]);

const KIND_LABEL: Record<StudyPlanItemResource["resource_kind"], string> = {
  book_pages: "Book",
  pdf: "PDF",
  link: "Link",
  video: "Video",
  note: "Note"
};

const KIND_ICON: Record<StudyPlanItemResource["resource_kind"], string> = {
  book_pages: "📕",
  pdf: "📄",
  link: "🔗",
  video: "▶",
  note: "🗒"
};

function ResourceList({ resources }: { resources: StudyPlanItemResource[] }) {
  if (resources.length === 0) {
    return (
      <div
        style={{
          padding: "18px 16px",
          fontSize: 12.5,
          color: "var(--sp-ink-soft)",
          textAlign: "center"
        }}
      >
        No resources attached to this day yet.
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--sp-line)", borderRadius: 9, overflow: "hidden" }}>
      <div
        style={{
          padding: "9px 12px",
          background: "var(--sp-panel-2)",
          fontFamily: "var(--sp-mono)",
          fontSize: 9.5,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--sp-ink-faint)",
          borderBottom: "1px solid var(--sp-line-soft)"
        }}
      >
        {resources.length} resource{resources.length === 1 ? "" : "s"}
      </div>
      {resources.map((resource, index) => {
        const content = (
          <>
            <span style={{ marginRight: 8 }}>{KIND_ICON[resource.resource_kind]}</span>
            {resource.title}
            <span className="sp-pill" style={{ marginLeft: 6 }}>
              {KIND_LABEL[resource.resource_kind]}
            </span>
          </>
        );
        return (
          <div
            key={resource.id}
            style={{
              padding: "10px 12px",
              borderBottom: index === resources.length - 1 ? undefined : "1px solid var(--sp-line-soft)",
              fontSize: 12.5
            }}
          >
            {resource.url ? (
              <a
                href={resource.url}
                target="_blank"
                rel="noreferrer noopener"
                style={{ color: "var(--sp-ink)", textDecoration: "none" }}
              >
                {content}
              </a>
            ) : (
              <div>
                <div>{content}</div>
                {resource.body && (
                  <p style={{ margin: "6px 0 0", color: "var(--sp-ink-soft)", lineHeight: 1.5 }}>{resource.body}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Designed in the study-plan flow, not yet built — said plainly, not faked. */
function DiscussionStub() {
  return (
    <div className="sp-note" style={{ margin: "12px 0 0" }}>
      <strong>Discussion is not built yet.</strong> Test-series plans are designed to carry a per-paper thread where
      the answer key gets argued out. Nothing like it exists in the app today, so this space is deliberately empty
      rather than showing a placeholder that never fills.
    </div>
  );
}

export function StudyPlanItemScreen({
  plan: initialPlan,
  itemId
}: {
  plan: StudyPlanDetail;
  itemId: number;
}) {
  const { token, isInitialized } = useAuth();
  const [plan, setPlan] = useState(initialPlan);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!isInitialized || !token) return;
    void authenticatedGet<StudyPlanDetail>(`/api/v1/study-plans/${initialPlan.id}`, token)
      .then(setPlan)
      .catch((error) => console.error(error));
  }, [isInitialized, token, initialPlan.id]);

  const item: StudyPlanItem | undefined = (plan.items ?? []).find((candidate) => candidate.id === itemId);

  if (!item) {
    return (
      <div className="sp-root" style={{ background: "var(--sp-bg)", minHeight: "100vh" }}>
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px", fontFamily: "var(--sp-body)" }}>
          <div className="sp-c" style={{ padding: 24, textAlign: "center", color: "var(--sp-ink-soft)" }}>
            <p style={{ margin: 0, fontSize: 13.5 }}>
              This day is not available to you yet. Enrol in the plan to open it.
            </p>
            <Link className="sp-btn sp-btn--p" style={{ marginTop: 14 }} href={studyPlanHref(`/${plan.id}`)}>
              Back to the plan
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isTest = TEST_TYPES.has(item.item_type);
  const isLecture = item.item_type === "live_lecture" || Boolean(item.lecture_url);
  const resources = item.resources ?? [];
  const done = item.progress?.status === "completed";

  const markComplete = async () => {
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      // Seconds actually spent on this screen, so the depth signal can tell a
      // read from a click-through.
      const timeSpentSeconds = Math.max(0, Math.round((Date.now() - openedAt) / 1000));
      const response = await fetch(`${browserBaseUrl}/api/v1/study-plan-items/${item.id}/progress`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: done ? "in_progress" : "completed", time_spent_seconds: timeSpentSeconds })
      });
      if (!response.ok) throw new Error(`Progress update failed with ${response.status}`);
      const fresh = await authenticatedGet<StudyPlanDetail>(`/api/v1/study-plans/${plan.id}`, token);
      setPlan(fresh);
    } catch (error) {
      console.error(error);
      setMessage("Could not update this step.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sp-root" style={{ background: "var(--sp-bg)", minHeight: "100vh" }}>
      <main
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "24px 20px 72px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontFamily: "var(--sp-body)",
          color: "var(--sp-ink)"
        }}
      >
        <Link
          href={studyPlanHref(`/${plan.id}`)}
          style={{
            fontFamily: "var(--sp-mono)",
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--sp-ink-faint)",
            textDecoration: "none"
          }}
        >
          ← {plan.title}
        </Link>

        <div className="sp-c" style={{ overflow: "hidden" }}>
          <div className="sp-ph">
            <div>
              <h3>
                {isTest ? "Test day" : isLecture ? "Lecture day" : "Reading day"}
              </h3>
              <p className="sp-hint">
                Week {item.week_no} · Day {item.day_no}
                {item.estimated_minutes ? ` · ${item.estimated_minutes} min` : ""}
              </p>
            </div>
            <span className={`sp-type ${PLAN_TYPE_CLASS[plan.plan_type]}`}>{PLAN_TYPE_LABEL[plan.plan_type]}</span>
          </div>

          <div style={{ padding: "14px 17px", display: "flex", flexDirection: "column", gap: 10 }}>
            <h4 style={{ fontFamily: "var(--sp-display)", fontSize: 18, fontWeight: 750, margin: 0 }}>{item.title}</h4>
            {item.description && (
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--sp-ink-soft)", lineHeight: 1.6 }}>
                {item.description}
              </p>
            )}

            {isLecture && (
              <div className="sp-player" style={{ marginTop: 2 }}>
                <span className="sp-play">▶</span>
                <div className="sp-cap">
                  <p>Week {item.week_no} · Lecture</p>
                  <h4>{item.title}</h4>
                </div>
              </div>
            )}

            {isLecture && item.lecture_url && (
              <a className="sp-btn sp-btn--p" href={item.lecture_url} target="_blank" rel="noreferrer noopener">
                Open the lecture
              </a>
            )}

            {isTest ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--sp-ink-soft)" }}>
                  {item.test_template
                    ? `${item.test_template.title} · ${item.test_template.duration_minutes} minutes`
                    : "This day is a test."}
                </p>
                {item.test_template_id ? (
                  <Link
                    className="sp-btn sp-btn--p"
                    href={`/study-plans/${plan.id}/tests/${item.test_template_id}`}
                    style={{ width: "fit-content" }}
                  >
                    Start the test
                  </Link>
                ) : (
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--sp-ink-faint)" }}>
                    No test has been attached to this day yet.
                  </p>
                )}
                {plan.plan_type === "test_series" && <DiscussionStub />}
              </div>
            ) : (
              <ResourceList resources={resources} />
            )}

            {message && (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--sp-bad)", fontWeight: 650 }}>{message}</p>
            )}

            {!isTest && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={`sp-btn sp-btn--sm${done ? "" : " sp-btn--p"}`}
                  style={{ flex: 1, justifyContent: "center" }}
                  disabled={busy || !token}
                  onClick={markComplete}
                >
                  {busy ? "Saving…" : done ? "Mark as not done" : "Mark complete"}
                </button>
              </div>
            )}

            {!token && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--sp-ink-faint)" }}>
                Sign in to record your progress on this day.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

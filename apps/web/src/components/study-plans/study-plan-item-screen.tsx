"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedGet, useAuth } from "../auth/auth-context";
import { browserBaseUrl } from "../../lib/api";
import {
  formatIsoDateLong,
  PLAN_TYPE_CLASS,
  PLAN_TYPE_LABEL,
  studyPlanHref,
  type StudyPlanDetail,
  type StudyPlanItem,
  type StudyPlanItemResource
} from "../../lib/study-plans";
import { InlineSignInPrompt } from "../assessment/sign-in-required-notice";

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

/** YouTube and Vimeo need an iframe; a direct file can use a real <video>. */
function embedUrl(url: string, startSeconds = 0): string | null {
  try {
    const parsed = new URL(url, "https://placeholder.invalid");
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return `https://www.youtube.com/embed${parsed.pathname}?start=${Math.floor(startSeconds)}`;
    }
    if (host.endsWith("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}?start=${Math.floor(startSeconds)}`;
      if (parsed.pathname.startsWith("/embed/")) return url;
    }
    if (host.endsWith("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}#t=${Math.floor(startSeconds)}s`;
    }
    return null;
  } catch {
    return null;
  }
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
}

function isPdf(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

/** A PDF read in place rather than punted to a new browser tab. */
function PdfViewer({ url, title }: { url: string; title: string }) {
  return (
    <div style={{ border: "1px solid var(--sp-line)", borderRadius: 9, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "8px 12px",
          background: "var(--sp-panel-2)",
          borderBottom: "1px solid var(--sp-line-soft)"
        }}
      >
        <span style={{ fontFamily: "var(--sp-mono)", fontSize: 9.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sp-ink-faint)" }}>
          {title}
        </span>
        <a className="sp-btn sp-btn--sm" href={url} target="_blank" rel="noreferrer noopener">
          Open full size
        </a>
      </div>
      <iframe src={url} title={title} style={{ width: "100%", height: 520, border: 0, display: "block" }} />
    </div>
  );
}

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [positionSaved, setPositionSaved] = useState(false);

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
  const liveClass = item.live_class;
  const resources = item.resources ?? [];
  const done = item.progress?.status === "completed";

  const resumeAt = Number(item.progress?.last_position_seconds ?? 0);

  /**
   * Where the lecture actually plays from. A direct file gets a real <video>
   * so the position can be read back; YouTube and Vimeo get an iframe with a
   * start offset, which is as far as their embeds allow without their SDKs.
   */
  const lectureSource: { kind: "file" | "iframe"; url: string } | null = (() => {
    const url = item.lecture_url ?? item.resources?.find((resource) => resource.resource_kind === "video")?.url ?? null;
    if (!url) return null;
    if (isDirectVideo(url)) return { kind: "file", url };
    const embed = embedUrl(url, resumeAt);
    return embed ? { kind: "iframe", url: embed } : { kind: "iframe", url };
  })();

  /** Only a real <video> can report a position, so only that path saves one. */
  const savePosition = useCallback(async () => {
    const node = videoRef.current;
    if (!node || !token) return;
    const seconds = Math.floor(node.currentTime);
    if (seconds < 3) return;
    try {
      await fetch(`${browserBaseUrl}/api/v1/study-plan-items/${itemId}/progress`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "in_progress", last_position_seconds: seconds })
      });
      setPositionSaved(true);
    } catch (error) {
      console.error(error);
    }
  }, [token, itemId]);

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

            {/* A class taught in the app, rather than linked out to. The room
                itself decides host vs viewer from the server's own token, so
                this is only the way in. */}
            {liveClass && liveClass.status !== "cancelled" && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 11,
                  border: liveClass.status === "live" ? "1px solid var(--sp-accent-line)" : "1px solid var(--sp-line)",
                  background: liveClass.status === "live" ? "var(--sp-accent-soft)" : "var(--sp-panel-2)"
                }}
              >
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--sp-mono)",
                      fontSize: 10.5,
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                      color: liveClass.status === "live" ? "var(--sp-accent-ink)" : "var(--sp-ink-faint)"
                    }}
                  >
                    {liveClass.status === "live"
                      ? "● Live now"
                      : liveClass.status === "ended"
                        ? "Class ended"
                        : "Live class scheduled"}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 650 }}>{liveClass.title}</p>
                  {liveClass.status === "scheduled" && (
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--sp-ink-faint)" }}>
                      Starts {formatIsoDateLong(liveClass.scheduled_start)}
                    </p>
                  )}
                </div>
                {liveClass.status === "live" ? (
                  <Link className="sp-btn sp-btn--p" href={studyPlanHref(`/live/${liveClass.id}`)}>
                    Join the class
                  </Link>
                ) : liveClass.status === "scheduled" ? (
                  <span style={{ fontSize: 12, color: "var(--sp-ink-faint)" }}>
                    The join button appears here when your teacher starts.
                  </span>
                ) : null}
              </div>
            )}

            {/* When a day has both, the video below is the recording of the
                class above — say so, rather than leaving two players' worth of
                lecture on one screen with no explanation. */}
            {liveClass && liveClass.status !== "cancelled" && lectureSource !== null && (
              <p
                style={{
                  margin: "2px 0 0",
                  fontFamily: "var(--sp-mono)",
                  fontSize: 10.5,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "var(--sp-ink-faint)"
                }}
              >
                {liveClass.status === "ended" ? "Recording of this class" : "Recording — available if you miss it"}
              </p>
            )}

            {isLecture && (
              lectureSource === null ? (
                // A day whose lecture is taught live in the app has no link to
                // show, and saying "no lecture link" there reads as a mistake.
                liveClass && liveClass.status !== "cancelled" ? null : (
                  <>
                    <div className="sp-player" style={{ marginTop: 2 }}>
                      <span className="sp-play">▶</span>
                      <div className="sp-cap">
                        <p>Week {item.week_no} · Lecture</p>
                        <h4>{item.title}</h4>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--sp-ink-faint)" }}>
                      No lecture link on this day yet.
                    </p>
                  </>
                )
              ) : lectureSource.kind === "file" ? (
                <div>
                  <video
                    ref={videoRef}
                    src={lectureSource.url}
                    controls
                    preload="metadata"
                    style={{ width: "100%", borderRadius: 11, display: "block", background: "#000" }}
                    onLoadedMetadata={() => {
                      // Pick up where they stopped, if they got past the first
                      // few seconds and did not already finish.
                      if (videoRef.current && resumeAt > 3) videoRef.current.currentTime = resumeAt;
                    }}
                    onPause={savePosition}
                    onEnded={savePosition}
                  />
                  {resumeAt > 3 && !positionSaved && (
                    <p style={{ margin: "6px 0 0", fontFamily: "var(--sp-mono)", fontSize: 10.5, color: "var(--sp-ink-faint)" }}>
                      Resuming from {Math.floor(resumeAt / 60)}:{String(Math.floor(resumeAt % 60)).padStart(2, "0")}
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 11, overflow: "hidden" }}>
                  <iframe
                    src={lectureSource.url}
                    title={item.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                  />
                </div>
              )
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
              <>
                <ResourceList resources={resources} />
                {resources
                  .filter((resource) => resource.url && (resource.resource_kind === "pdf" || isPdf(resource.url)))
                  .map((resource) => (
                    <PdfViewer key={resource.id} url={resource.url!} title={resource.title} />
                  ))}
              </>
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
                <InlineSignInPrompt message="Sign in to record your progress on this day." />
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

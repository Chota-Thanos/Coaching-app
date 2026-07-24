"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth, authenticatedGet, authenticatedPost } from "../../../components/auth/auth-context";
import { ArrowLeft, Calendar, FileText, CheckCircle2, AlertCircle, Video, User, Star, MapPin, BadgeHelp, Sparkles } from "lucide-react";
import Link from "next/link";
import { browserBaseUrl } from "../../../lib/api";

type MentorProfile = {
  id: number;
  user_id: number;
  display_name: string;
  headline: string | null;
  bio: string | null;
  years_experience: number;
  city: string | null;
  profile_image_url: string | null;
  education: string | null;
  is_verified: boolean;
  specialization_tags: string[];
  highlights: string[];
  credentials: string[];
  email: string;
  username: string;
  specifications?: string[];
  exams?: string[];
  specialization_type?: "all_areas" | "specific_field";
  mentor_type?: "evaluation_mentorship" | "only_mentorship";
};

type MainsAttempt = {
  id: number;
  question_version_id: number;
  submitted_at: string;
  question_statement: string;
  question_prompt: string | null;
  paper_name: string | null;
  evaluation_status: string;
};

export default function MentorDetailPage({ params }: { params: Promise<{ mentorId: string }> }) {
  const resolvedParams = use(params);
  const mentorId = Number(resolvedParams.mentorId);
  const router = useRouter();
  const { user, token, isInitialized } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mentor, setMentor] = useState<MentorProfile | null>(null);
  
  // Student Mains attempts
  const [attempts, setAttempts] = useState<MainsAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  // Form states
  const [preferredMode, setPreferredMode] = useState("video");
  const [note, setNote] = useState("");
  const [attachCopy, setAttachCopy] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>("");
  const [copySource, setCopySource] = useState<"platform" | "upload">("upload");
  const [studentCopy, setStudentCopy] = useState<{ file_name: string; url: string } | null>(null);
  const [uploadingCopy, setUploadingCopy] = useState(false);

  const fetchMentor = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${browserBaseUrl}/api/v1/mentorship/profiles/${mentorId}`);
      if (res.ok) {
        const data = await res.json();
        setMentor(data);
      } else {
        alert("Mentor profile not found");
        router.push("/mentors");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttempts = async () => {
    if (!token) return;
    try {
      setLoadingAttempts(true);
      const data = await authenticatedGet<MainsAttempt[]>("/api/v1/assessment/mains/my-answers", token);
      setAttempts(data || []);
      if (data && data.length > 0) {
        setSelectedAttemptId(String(data[0]?.id || ""));
      }
    } catch (err) {
      console.error("Failed to load student Mains attempts:", err);
    } finally {
      setLoadingAttempts(false);
    }
  };

  useEffect(() => {
    if (mentorId) {
      void fetchMentor();
    }
  }, [mentorId]);

  useEffect(() => {
    if (token && attachCopy) {
      void fetchAttempts();
    }
  }, [token, attachCopy]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push("/login");
      return;
    }
    if (!token) return;

    setSubmitting(true);
    try {
      const payload = {
        mentor_id: mentorId,
        mains_answer_attempt_id: attachCopy && copySource === "platform" && selectedAttemptId ? Number(selectedAttemptId) : null,
        student_copy: attachCopy && copySource === "upload" && studentCopy ? studentCopy : null,
        preferred_mode: preferredMode,
        note: note.trim() || undefined,
      };

      await authenticatedPost("/api/v1/mentorship/requests", token, payload);
      alert("Mentorship request sent successfully! You can track and pay for bookings in your Mentorship Desk.");
      router.push("/dashboard/mentorship");
    } catch (err: any) {
      alert("Failed to submit request: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !mentor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading mentor profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-10">
      <div className="container mx-auto max-w-5xl px-6">
        <Link href="/mentors" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline mb-8">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Directory
        </Link>

        {/* Profile Card */}
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Main Info */}
          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-surface p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start gap-6 border-b border-slate-100 pb-6 mb-6">
                {mentor.profile_image_url ? (
                  <img
                    src={mentor.profile_image_url}
                    alt={mentor.display_name}
                    className="h-24 w-24 rounded-3xl object-cover border border-slate-100"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-50 text-3xl font-black text-indigo-600">
                    {mentor.display_name.charAt(0)}
                  </div>
                )}
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">{mentor.display_name}</h1>
                    {mentor.is_verified && (
                      <span className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <p className="text-indigo-600 text-sm font-bold">{mentor.headline || "Expert UPSC Mentor"}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1.5">
                    {mentor.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {mentor.city}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {mentor.years_experience} Years mentoring experience
                    </span>
                  </div>
                </div>
              </div>

              {/* Type, Scope & Specs */}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <span className="rounded-xl bg-indigo-50 border border-indigo-100/50 text-indigo-700 px-3.5 py-1 text-xs font-bold uppercase tracking-wider">
                  {mentor.mentor_type === "only_mentorship" ? "Only Mentorship" : "Evaluation + Mentorship"}
                </span>
                <span className="rounded-xl bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-1 text-xs font-bold uppercase tracking-wider">
                  {mentor.specialization_type === "specific_field" ? "Specific Field Expert" : "Expert in all areas"}
                </span>
              </div>

              {/* Target Exams & Specifications */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2 bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                {mentor.specifications && mentor.specifications.length > 0 && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Approved Specifications</span>
                    <div className="flex flex-wrap gap-1">
                      {mentor.specifications.map((spec, sidx) => (
                        <span key={sidx} className="rounded-full bg-emerald-50 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold border border-emerald-100/45">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {mentor.exams && mentor.exams.length > 0 && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Target Exams Coverage</span>
                    <p className="text-xs font-extrabold text-slate-700">{mentor.exams.join(", ")}</p>
                  </div>
                )}
              </div>

              {/* Mentor Question Sets if evaluation_source === "own_questions" */}
              {mentor.mentor_type !== "only_mentorship" && (mentor as any).meta?.evaluation_source === "own_questions" && (
                <div className="space-y-2 pt-6 border-t border-slate-100 mt-6 animate-in fade-in duration-200">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    Required Mentor Question Sets
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    This mentor only evaluates copies of their own specific questions. Please review them below:
                  </p>
                  <div className="grid gap-2 mt-2">
                    {(mentor as any).meta?.question_pdfs?.map((q: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                        <span className="font-bold text-slate-700">{q.file_name}</span>
                        {q.locked ? (
                          <span className="rounded-full bg-slate-200 text-slate-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                            🔒 Locked until paid
                          </span>
                        ) : (
                          <a
                            href={q.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-indigo-600 text-white px-3 py-1 text-[10px] font-bold hover:bg-indigo-700 transition"
                          >
                            Download Question PDF
                          </a>
                        )}
                      </div>
                    ))}
                    {(!(mentor as any).meta?.question_pdfs || (mentor as any).meta?.question_pdfs.length === 0) && (
                      <p className="text-xs text-slate-400 italic">No question sets configured by this mentor yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Bio */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Biography</h3>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{mentor.bio}</p>
              </div>

              {/* Education */}
              {mentor.education && (
                <div className="space-y-2 pt-6 border-t border-slate-100 mt-6 animate-in fade-in slide-in-from-top-1 duration-200">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Education</h3>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{mentor.education}</p>
                </div>
              )}

              {/* Specialties & Highlights */}
              <div className="mt-8 grid gap-6 md:grid-cols-2 pt-6 border-t border-slate-100">
                {/* Specialties */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {mentor.specialization_tags?.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-50 border border-slate-100 px-3.5 py-1 text-xs font-semibold text-slate-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Highlights */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Highlights</h3>
                  <div className="space-y-2">
                    {mentor.highlights?.map((hl, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                        <span>{hl}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Credentials Card */}
            {mentor.credentials && mentor.credentials.length > 0 && (
              <div className="rounded-[32px] border border-slate-200 bg-surface p-8 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">Credentials & Verification</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {mentor.credentials.map((cred, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs font-bold text-slate-700">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      <span>{cred}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Booking Request Widget */}
          <div className="sticky top-10">
            <div className="rounded-[32px] border border-slate-200 bg-surface p-6 shadow-sm">
              <div className="flex items-baseline justify-between mb-6">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Consultation Fee</span>
                <span className="text-3xl font-black text-slate-900">₹1,000 <span className="text-xs font-normal text-slate-500">/ Session</span></span>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Preferred Mode</label>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPreferredMode("video")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border py-3 text-xs font-bold transition ${
                        preferredMode === "video"
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                          : "border-slate-200 bg-surface text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Video className="h-4 w-4" />
                      Agora Video
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreferredMode("chat_only")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border py-3 text-xs font-bold transition ${
                        preferredMode === "chat_only"
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                          : "border-slate-200 bg-surface text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Chat Triage
                    </button>
                  </div>
                </div>

                {/* Optional copy evaluation toggle -- only offered by mentors who do evaluation */}
                {mentor.mentor_type === "only_mentorship" ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-2">
                    <BadgeHelp className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-500 leading-normal">
                      This mentor offers guidance-only mentorship and does not evaluate answer copies. This session will be a pure mentorship/guidance call.
                    </p>
                  </div>
                ) : (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/20 p-4 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attachCopy}
                      onChange={(e) => setAttachCopy(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                      Link Copy Evaluation
                    </span>
                  </label>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Check this to submit a subjective Mains answer copy to evaluate. The mentor will review and grade your copy before scheduling.
                  </p>

                  {attachCopy && (
                    <div className="pt-2 border-t border-indigo-100/50 space-y-3">
                      {/* Copy Source Toggle */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCopySource("upload")}
                          className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold border transition ${
                            copySource === "upload"
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                              : "bg-surface border-slate-200 text-slate-600"
                          }`}
                        >
                          Upload Copy (PDF/Img)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCopySource("platform")}
                          className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold border transition ${
                            copySource === "platform"
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                              : "bg-surface border-slate-200 text-slate-600"
                          }`}
                        >
                          Select Mains Attempt
                        </button>
                      </div>

                      {copySource === "upload" ? (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                            Upload Answer Copy (PDF / Image) <span className="text-rose-500">*</span>
                          </label>
                          {studentCopy ? (
                            <div className="flex items-center justify-between bg-surface p-2.5 rounded-xl border border-slate-200 text-xs">
                              <span className="font-medium text-slate-700 truncate max-w-[200px]">{studentCopy.file_name}</span>
                              <button
                                type="button"
                                onClick={() => setStudentCopy(null)}
                                className="text-xs font-bold text-rose-600 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-surface hover:bg-slate-50 transition rounded-xl p-4 cursor-pointer">
                              <FileText className="h-5 w-5 text-slate-400 mb-1" />
                              <span className="text-[10px] font-bold text-slate-500">
                                {uploadingCopy ? "Uploading..." : "Click to select File"}
                              </span>
                              <input
                                type="file"
                                accept="application/pdf,image/*"
                                disabled={uploadingCopy}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setUploadingCopy(true);
                                  try {
                                    const res = await fetch(`${browserBaseUrl}/api/v1/onboarding/assets/upload`, {
                                      method: "POST",
                                      headers: {
                                        "content-type": "application/json",
                                        "authorization": `Bearer ${token}`
                                      },
                                      body: JSON.stringify({ file_name: file.name, asset_kind: "student_copy" })
                                    });
                                    if (res.ok) {
                                      const data = await res.json();
                                      setStudentCopy({ file_name: file.name, url: data.url });
                                    } else {
                                      alert("Upload failed.");
                                    }
                                  } catch (err) {
                                    console.error(err);
                                    alert("Error uploading file.");
                                  } finally {
                                    setUploadingCopy(false);
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      ) : (
                        <div>
                          {loadingAttempts ? (
                            <div className="text-[10px] text-slate-400">Loading copies...</div>
                          ) : attempts.length === 0 ? (
                            <div className="text-[10px] text-rose-600 flex items-center gap-1 bg-surface p-2 rounded-lg border border-rose-100">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              No Mains attempts found. Go submit an attempt in the mains module first.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                                Select Mains Copy
                              </label>
                              <select
                                value={selectedAttemptId}
                                onChange={(e) => setSelectedAttemptId(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-surface px-2 py-2 text-xs outline-none cursor-pointer"
                              >
                                {attempts.map((att) => (
                                  <option key={att.id} value={att.id}>
                                    #{att.id} - {att.paper_name || "Mains Attempt"} ({new Date(att.submitted_at).toLocaleDateString()})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Note / Preparation Focus</label>
                  <textarea
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Tell the mentor what goals you have for this session..."
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-xs outline-none transition focus:border-indigo-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || (attachCopy && copySource === "platform" && attempts.length === 0) || (attachCopy && copySource === "upload" && !studentCopy)}
                  className="w-full rounded-2xl bg-indigo-600 py-3.5 font-bold text-white transition hover:bg-indigo-700 shadow-lg shadow-indigo-600/10 disabled:opacity-60"
                >
                  {submitting ? "Sending..." : "Request Mentorship"}
                </button>

                <p className="text-[10px] text-slate-400 text-center leading-normal">
                  Sending a request starts a private chat with the mentor. Payment is requested after the mentor reviews and accepts your request.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

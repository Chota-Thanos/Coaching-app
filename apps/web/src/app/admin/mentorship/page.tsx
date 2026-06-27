"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, authenticatedGet, authenticatedPut } from "../../../components/auth/auth-context";
import { ArrowLeft, CheckCircle2, XCircle, FileText, Phone, MapPin, ExternalLink, ShieldAlert, Sparkles, User, Calendar, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";

const DEFAULT_SPECS = [
  "Mentor for Prelims Exam",
  "Mentor for Mains",
  "Mentor for GS 1",
  "Complete Mentorship"
];

type OnboardingAsset = {
  bucket: string;
  path: string;
  file_name: string;
  mime_type?: string;
  size_bytes?: number;
  uploaded_at?: string;
  url?: string;
};

type OnboardingDetails = {
  current_occupation: string | null;
  professional_headshot: OnboardingAsset | null;
  upsc_roll_number: string | null;
  upsc_years: string | null;
  proof_documents: OnboardingAsset[];
  mains_written_count: number | null;
  interview_faced_count: number | null;
  optional_subject: string | null;
  gs_preferences: string[];
  mentorship_years: number | null;
  institute_associations: string[];
  sample_evaluation: OnboardingAsset | null;
  intro_video_url: string | null;
};

type OnboardingApplication = {
  id: number;
  user_id: number;
  email_snapshot: string | null;
  desired_role: string;
  full_name: string;
  city: string | null;
  years_experience: number | null;
  phone: string;
  about: string | null;
  status: "draft" | "pending" | "approved" | "rejected" | "more_info_required";
  details: OnboardingDetails;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export default function AdminMentorshipPage() {
  const router = useRouter();
  const { user, token, isInitialized } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<OnboardingApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "more_info_required" | "all" | "settings">("pending");
  const [selectedApp, setSelectedApp] = useState<OnboardingApplication | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [customSpecText, setCustomSpecText] = useState("");

  const [targetExams, setTargetExams] = useState<string[]>(["UPSC CSE", "UPPSC", "BPSC", "MPSC"]);
  const [approvedSpecs, setApprovedSpecs] = useState<string[]>([
    "Mentor for Prelims Exam",
    "Mentor for Mains",
    "Mentor for GS 1",
    "Complete Mentorship"
  ]);
  const [newExamText, setNewExamText] = useState("");
  const [newSpecText, setNewSpecText] = useState("");

  useEffect(() => {
    if (isInitialized) {
      if (!user) {
        router.push("/login");
      } else if (!["admin", "moderator"].includes(user.role)) {
        router.push("/");
      }
    }
  }, [isInitialized, user, router]);

  const fetchSettings = async () => {
    if (!token) return;
    try {
      const data = await authenticatedGet<any>("/api/v1/mentorship/settings", token);
      if (data.target_exams) setTargetExams(data.target_exams);
      if (data.approved_specifications) setApprovedSpecs(data.approved_specifications);
    } catch (err) {
      console.error("Failed to fetch mentorship settings:", err);
    }
  };

  useEffect(() => {
    if (token && user && ["admin", "moderator"].includes(user.role)) {
      void fetchSettings();
    }
  }, [token]);

  const fetchApplications = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await authenticatedGet<OnboardingApplication[]>(
        `/api/v1/admin/onboarding/applications?status=${statusFilter}`,
        token
      );
      setApplications(data);
      if (selectedApp) {
        const updated = data.find((app) => app.id === selectedApp.id);
        setSelectedApp(updated || null);
      }
    } catch (err) {
      console.error("Failed to load onboarding applications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && user && ["admin", "moderator"].includes(user.role)) {
      if (statusFilter !== "settings") {
        void fetchApplications();
      } else {
        setLoading(false);
      }
    }
  }, [token, statusFilter]);

  const handleSaveSetting = async (key: "target_exams" | "approved_specifications") => {
    if (!token) return;
    const isExam = key === "target_exams";
    const text = isExam ? newExamText.trim() : newSpecText.trim();
    if (!text) return;

    const currentList = isExam ? targetExams : approvedSpecs;
    if (currentList.includes(text)) {
      alert("This option already exists.");
      return;
    }

    const updatedList = [...currentList, text];
    try {
      await authenticatedPut("/api/v1/admin/mentorship/settings", token, {
        key,
        value: updatedList
      });
      if (isExam) {
        setTargetExams(updatedList);
        setNewExamText("");
      } else {
        setApprovedSpecs(updatedList);
        setNewSpecText("");
      }
    } catch (err: any) {
      alert("Failed to update setting: " + err.message);
    }
  };

  const handleDeleteSetting = async (key: "target_exams" | "approved_specifications", itemToDelete: string) => {
    if (!token) return;
    const isExam = key === "target_exams";
    const currentList = isExam ? targetExams : approvedSpecs;
    const updatedList = currentList.filter((item) => item !== itemToDelete);

    try {
      await authenticatedPut("/api/v1/admin/mentorship/settings", token, {
        key,
        value: updatedList
      });
      if (isExam) {
        setTargetExams(updatedList);
      } else {
        setApprovedSpecs(updatedList);
      }
    } catch (err: any) {
      alert("Failed to update setting: " + err.message);
    }
  };

  const handleReview = async (action: "approve" | "reject" | "request_more_info") => {
    if (!token || !selectedApp) return;
    if (action === "request_more_info" && !reviewerNote.trim()) {
      alert("Please provide details in the Reviewer Note of what more information is required.");
      return;
    }
    setSubmittingReview(true);
    try {
      await authenticatedPut(`/api/v1/admin/onboarding/applications/${selectedApp.id}/review`, token, {
        action,
        reviewer_note: reviewerNote.trim() || null,
        specifications: action === "approve" ? selectedSpecs : undefined
      });
      let resultMessage = "";
      if (action === "approve") resultMessage = "approved";
      else if (action === "reject") resultMessage = "rejected";
      else resultMessage = "marked as more info required";

      alert(`Application ${resultMessage} successfully!`);
      setReviewerNote("");
      void fetchApplications();
    } catch (err: any) {
      alert("Failed to submit review: " + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!isInitialized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading onboarding queue...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-10">
      <div className="container mx-auto max-w-6xl px-6">
        {/* Navigation & Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="space-y-1">
            <Link href="/admin" className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Hub
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-8 w-8 text-indigo-600" />
              Mentor Onboarding reviews
            </h1>
            <p className="text-slate-500 text-sm">
              Review credential documents and approve UPSC mentor roles.
            </p>
          </div>

          <div className="inline-flex rounded-2xl bg-white p-1 border border-slate-200 shadow-sm">
            {(["pending", "approved", "rejected", "more_info_required", "all", "settings"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setStatusFilter(filter);
                  setSelectedApp(null);
                }}
                className={`rounded-xl px-4 py-2 text-xs font-bold capitalize transition-all ${
                  statusFilter === filter
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
                }`}
              >
                {filter === "more_info_required" ? "More Info Required" : filter === "settings" ? "Settings" : filter}
              </button>
            ))}
          </div>
        </div>

        {/* Master-Detail Grid */}
        {statusFilter === "settings" ? (
          <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" /> Mentorship Settings Configuration
            </h2>
            <div className="grid gap-8 md:grid-cols-2">
              {/* Target Exams Column */}
              <div className="space-y-4 border-r border-slate-100 pr-6">
                <div>
                  <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Target Exams</h3>
                  <p className="text-slate-500 text-xs mt-1">Manage the exams mentors can select during profile configuration.</p>
                </div>

                <div className="flex flex-wrap gap-2 py-2">
                  {targetExams.map((exam) => (
                    <span
                      key={exam}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-200 transition hover:bg-slate-200"
                    >
                      {exam}
                      <button
                        type="button"
                        onClick={() => handleDeleteSetting("target_exams", exam)}
                        className="text-slate-400 hover:text-slate-600 font-bold ml-1 text-sm"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  {targetExams.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No exams configured.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. GPSC, IAS"
                    value={newExamText}
                    onChange={(e) => setNewExamText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveSetting("target_exams");
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveSetting("target_exams")}
                    className="rounded-xl bg-slate-900 text-white px-4 py-2 text-xs font-bold hover:bg-slate-800 transition animate-pulse"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Approved Specifications Column */}
              <div className="space-y-4 pl-2">
                <div>
                  <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Approved Specifications</h3>
                  <p className="text-slate-500 text-xs mt-1">Manage the specifications checklist that admins assign to approved mentors.</p>
                </div>

                <div className="flex flex-wrap gap-2 py-2">
                  {approvedSpecs.map((spec) => (
                    <span
                      key={spec}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 border border-indigo-100 transition hover:bg-indigo-100"
                    >
                      {spec}
                      <button
                        type="button"
                        onClick={() => handleDeleteSetting("approved_specifications", spec)}
                        className="text-indigo-400 hover:text-indigo-600 font-bold ml-1 text-sm"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  {approvedSpecs.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No specifications configured.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Mentor for Ethics, Interview Expert"
                    value={newSpecText}
                    onChange={(e) => setNewSpecText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveSetting("approved_specifications");
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveSetting("approved_specifications")}
                    className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-xs font-bold hover:bg-indigo-700 transition animate-pulse"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          {/* Applications list */}
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
              Applications ({applications.length})
            </h2>

            <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
              {applications.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                  No applications found in this queue.
                </div>
              ) : (
                applications.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => {
                      setSelectedApp(app);
                      setReviewerNote(app.reviewer_note || "");
                      setSelectedSpecs((app as any).specifications || []);
                      setCustomSpecText("");
                    }}
                    className={`w-full text-left rounded-3xl p-5 border transition-all ${
                      selectedApp?.id === app.id
                        ? "border-indigo-600 bg-indigo-50/40 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm leading-snug">{app.full_name}</h3>
                        <p className="text-xs text-slate-500 mt-1">{app.email_snapshot || `User ID: ${app.user_id}`}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          app.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : app.status === "rejected"
                            ? "bg-rose-100 text-rose-800"
                            : app.status === "more_info_required"
                            ? "bg-indigo-100 text-indigo-800"
                            : app.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {app.status === "more_info_required" ? "more info" : app.status}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(app.created_at).toLocaleDateString()}
                      </span>
                      {app.years_experience !== null && (
                        <span className="font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          {app.years_experience} Years Exp.
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Application Detail view */}
          <div className="space-y-6">
            {selectedApp ? (
              <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
                  <div className="flex items-center gap-4">
                    {selectedApp.details?.professional_headshot?.url ? (
                      <img
                        src={selectedApp.details.professional_headshot.url}
                        alt="Headshot"
                        className="h-16 w-16 rounded-2xl object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                        <User className="h-8 w-8" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">{selectedApp.full_name}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {selectedApp.city || "No City"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" /> {selectedApp.phone}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Status:</span>
                    <span className={`rounded-xl px-3.5 py-1 text-xs font-black uppercase tracking-wider ${
                      selectedApp.status === "approved"
                        ? "bg-emerald-500 text-white"
                        : selectedApp.status === "rejected"
                        ? "bg-rose-500 text-white"
                        : selectedApp.status === "more_info_required"
                        ? "bg-indigo-500 text-white"
                        : "bg-amber-500 text-white"
                    }`}>
                      {selectedApp.status === "more_info_required" ? "more info required" : selectedApp.status}
                    </span>
                  </div>
                </div>

                {/* About / Summary */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Applicant Statement
                  </h3>
                  <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedApp.about || "No introduction bio provided."}
                  </div>
                </div>

                {/* Grid details */}
                <div className="grid gap-6 md:grid-cols-2 mb-6">
                  <div className="rounded-2xl border border-slate-100 p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">UPSC Credentials</h4>
                    <div className="space-y-2 text-xs text-slate-600">
                      <p className="flex justify-between border-b border-slate-50 pb-1.5">
                        <span className="font-medium">Roll Number:</span>
                        <span className="font-bold text-slate-800">{selectedApp.details?.upsc_roll_number || "n/a"}</span>
                      </p>
                      <p className="flex justify-between border-b border-slate-50 pb-1.5">
                        <span className="font-medium">Years Active:</span>
                        <span className="font-bold text-slate-800">{selectedApp.details?.upsc_years || "n/a"}</span>
                      </p>
                      <p className="flex justify-between border-b border-slate-50 pb-1.5">
                        <span className="font-medium">Mains Written:</span>
                        <span className="font-bold text-slate-800">{selectedApp.details?.mains_written_count ?? 0} times</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="font-medium">Interviews Faced:</span>
                        <span className="font-bold text-slate-800">{selectedApp.details?.interview_faced_count ?? 0} times</span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Expertise Focus</h4>
                    <div className="space-y-2 text-xs text-slate-600">
                      <p className="flex justify-between border-b border-slate-50 pb-1.5">
                        <span className="font-medium">Optional Subject:</span>
                        <span className="font-bold text-slate-800">{selectedApp.details?.optional_subject || "n/a"}</span>
                      </p>
                      <p className="flex justify-between border-b border-slate-50 pb-1.5">
                        <span className="font-medium">Occupation:</span>
                        <span className="font-bold text-slate-800">{selectedApp.details?.current_occupation || "n/a"}</span>
                      </p>
                      <p className="flex justify-between border-b border-slate-50 pb-1.5">
                        <span className="font-medium">GS Prefs:</span>
                        <span className="font-bold text-slate-800">
                          {selectedApp.details?.gs_preferences?.join(", ") || "None"}
                        </span>
                      </p>
                      <p className="flex justify-between">
                        <span className="font-medium">Institutes:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[180px]" title={selectedApp.details?.institute_associations?.join(", ")}>
                          {selectedApp.details?.institute_associations?.join(", ") || "None"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Supporting Documents */}
                <div className="grid gap-6 md:grid-cols-2 mb-8">
                  <div className="rounded-2xl border border-slate-100 p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Verification Proofs</h4>
                    <div className="space-y-2">
                      {selectedApp.details?.proof_documents?.map((proof, idx) => (
                        <a
                          key={idx}
                          href={proof.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 transition"
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                            {proof.file_name}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                        </a>
                      ))}
                      {(!selectedApp.details?.proof_documents || selectedApp.details.proof_documents.length === 0) && (
                        <p className="text-xs text-slate-400 italic">No files uploaded.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Evaluated Copy / Video</h4>
                    <div className="space-y-2">
                      {selectedApp.details?.sample_evaluation && (
                        <a
                          href={selectedApp.details.sample_evaluation.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-xl bg-indigo-50/40 border border-indigo-100/50 px-3 py-2 text-xs text-indigo-800 hover:bg-indigo-50 transition"
                        >
                          <span className="flex items-center gap-2 font-bold">
                            <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                            Sample Checked Evaluation
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 text-indigo-500" />
                        </a>
                      )}
                      {selectedApp.details?.intro_video_url && (
                        <a
                          href={selectedApp.details.intro_video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 transition"
                        >
                          <span className="flex items-center gap-2 font-medium truncate max-w-[200px]">
                            <ExternalLink className="h-4 w-4 text-slate-400 shrink-0" />
                            {selectedApp.details.intro_video_url}
                          </span>
                        </a>
                      )}
                      {!selectedApp.details?.sample_evaluation && !selectedApp.details?.intro_video_url && (
                        <p className="text-xs text-slate-400 italic">No evaluated samples or video link provided.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Review Form */}
                {selectedApp.status === "pending" ? (
                  <div className="border-t border-slate-100 pt-6 space-y-4">
                    <div className="border-t border-slate-100 pt-4">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                        Mentorship Specifications (Required for Approval)
                      </label>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {approvedSpecs.map((spec) => {
                          const isChecked = selectedSpecs.includes(spec);
                          return (
                            <label
                              key={spec}
                              className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium cursor-pointer transition ${
                                isChecked
                                  ? "border-indigo-600 bg-indigo-50/50 text-indigo-900"
                                  : "border-slate-200 hover:border-slate-300 text-slate-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSpecs([...selectedSpecs, spec]);
                                  } else {
                                    setSelectedSpecs(selectedSpecs.filter((s) => s !== spec));
                                  }
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                              />
                              {spec}
                            </label>
                          );
                        })}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customSpecText}
                          onChange={(e) => setCustomSpecText(e.target.value)}
                          placeholder="Add custom specification (e.g. Mentor for CSAT)..."
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (customSpecText.trim() && !selectedSpecs.includes(customSpecText.trim())) {
                                setSelectedSpecs([...selectedSpecs, customSpecText.trim()]);
                                setCustomSpecText("");
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customSpecText.trim() && !selectedSpecs.includes(customSpecText.trim())) {
                              setSelectedSpecs([...selectedSpecs, customSpecText.trim()]);
                              setCustomSpecText("");
                            }
                          }}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                        >
                          Add
                        </button>
                      </div>

                      {selectedSpecs.filter(s => !approvedSpecs.includes(s)).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {selectedSpecs
                            .filter((s) => !approvedSpecs.includes(s))
                            .map((spec) => (
                              <span
                                key={spec}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 border border-slate-200"
                              >
                                {spec}
                                <button
                                  type="button"
                                  onClick={() => setSelectedSpecs(selectedSpecs.filter((s) => s !== spec))}
                                  className="text-slate-400 hover:text-slate-600 font-bold ml-0.5"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Reviewer Note (Visible to applicant)
                      </label>
                      <textarea
                        rows={3}
                        value={reviewerNote}
                        onChange={(e) => setReviewerNote(e.target.value)}
                        placeholder="Provide feedback on proof checks, roll checks, or reasons for rejection..."
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-xs outline-none transition focus:border-indigo-500 resize-none"
                      />
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="button"
                        disabled={submittingReview}
                        onClick={() => handleReview("approve")}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/10 disabled:opacity-60 transition"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve Candidate
                      </button>
                      
                      <button
                        type="button"
                        disabled={submittingReview}
                        onClick={() => handleReview("request_more_info")}
                        className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/10 disabled:opacity-60 transition"
                      >
                        <AlertCircle className="h-4 w-4" />
                        Request More Info
                      </button>

                      <button
                        type="button"
                        disabled={submittingReview}
                        onClick={() => handleReview("reject")}
                        className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-3 text-xs font-bold text-white hover:bg-rose-700 shadow-md shadow-rose-600/10 disabled:opacity-60 transition"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject Application
                      </button>
                    </div>
                  </div>
                ) : (
                  selectedApp.reviewer_note && (
                    <div className="border-t border-slate-100 pt-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Reviewer Note Log</h4>
                      <p className="mt-2 text-slate-700 text-xs leading-relaxed bg-slate-50 p-4 rounded-xl">
                        {selectedApp.reviewer_note}
                      </p>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="flex h-[400px] flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
                <ShieldAlert className="h-12 w-12 text-slate-300 mb-3 animate-pulse" />
                <p className="text-sm font-medium">Select an application from the queue to review credentials.</p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

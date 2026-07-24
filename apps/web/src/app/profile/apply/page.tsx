"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, authenticatedGet, authenticatedPost } from "../../../components/auth/auth-context";
import { browserBaseUrl } from "../../../lib/api";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, FileText, Upload, Video } from "lucide-react";

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

const STEPS = ["Basic Profile", "UPSC Details", "Domain focus", "Skill Assessment"];
const GS_OPTIONS = ["GS1", "GS2", "GS3", "GS4", "Essay"];

export default function ProfileApplyPage() {
  const router = useRouter();
  const { user, token, isInitialized } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [applications, setApplications] = useState<OnboardingApplication[]>([]);
  const [activeApplication, setActiveApplication] = useState<OnboardingApplication | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [about, setAbout] = useState("");
  const [occupation, setOccupation] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [upscYears, setUpscYears] = useState("");
  const [mainsWritten, setMainsWritten] = useState("");
  const [interviewsFaced, setInterviewsFaced] = useState("");
  const [optionalSubject, setOptionalSubject] = useState("");
  const [gsPreferences, setGsPreferences] = useState<string[]>([]);
  const [instituteAssociations, setInstituteAssociations] = useState<string[]>([]);
  const [headshot, setHeadshot] = useState<OnboardingAsset | null>(null);
  const [proofs, setProofs] = useState<OnboardingAsset[]>([]);
  const [sampleEvaluation, setSampleEvaluation] = useState<OnboardingAsset | null>(null);
  const [videoUrl, setVideoUrl] = useState("");

  const [uploadingKind, setUploadingKind] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized && !user) {
      router.push("/login");
    }
  }, [isInitialized, user, router]);

  const fetchApplications = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await authenticatedGet<OnboardingApplication[]>("/api/v1/onboarding/applications/me", token);
      setApplications(data);
      const active = data[0] || null;
      setActiveApplication(active);

      if (active) {
        setFullName(active.full_name || "");
        setCity(active.city || "");
        setPhone(active.phone || "");
        setYearsExperience(active.years_experience !== null ? String(active.years_experience) : "");
        setAbout(active.about || "");

        const det = active.details || {};
        setOccupation(det.current_occupation || "");
        setRollNumber(det.upsc_roll_number || "");
        setUpscYears(det.upsc_years || "");
        setMainsWritten(det.mains_written_count !== null ? String(det.mains_written_count) : "");
        setInterviewsFaced(det.interview_faced_count !== null ? String(det.interview_faced_count) : "");
        setOptionalSubject(det.optional_subject || "");
        setGsPreferences(det.gs_preferences || []);
        setInstituteAssociations(det.institute_associations || []);
        setHeadshot(det.professional_headshot || null);
        setProofs(det.proof_documents || []);
        setSampleEvaluation(det.sample_evaluation || null);
        setVideoUrl(det.intro_video_url || "");

        setIsEditing(active.status === "draft" || active.status === "rejected" || active.status === "more_info_required");
      } else {
        setIsEditing(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      void fetchApplications();
    }
  }, [token]);

  const handleMockUpload = async (kind: "headshot" | "proof" | "sample", name: string) => {
    if (!token) return;
    setUploadingKind(kind);
    try {
      const result = await authenticatedPost<OnboardingAsset>(
        "/api/v1/onboarding/assets/upload",
        token,
        { file_name: name, asset_kind: kind }
      );
      if (kind === "headshot") {
        setHeadshot(result);
      } else if (kind === "proof") {
        setProofs((prev) => [...prev, result]);
      } else if (kind === "sample") {
        setSampleEvaluation(result);
      }
    } catch (err) {
      alert("Mock upload failed");
    } finally {
      setUploadingKind(null);
    }
  };

  const buildPayload = () => {
    const detailsObj: OnboardingDetails = {
      current_occupation: occupation || null,
      professional_headshot: headshot,
      upsc_roll_number: rollNumber || null,
      upsc_years: upscYears || null,
      proof_documents: proofs,
      mains_written_count: mainsWritten ? Number(mainsWritten) : null,
      interview_faced_count: interviewsFaced ? Number(interviewsFaced) : null,
      optional_subject: optionalSubject || null,
      gs_preferences: gsPreferences,
      mentorship_years: yearsExperience ? Number(yearsExperience) : null,
      institute_associations: instituteAssociations,
      sample_evaluation: sampleEvaluation,
      intro_video_url: videoUrl || null
    };

    return {
      desired_role: "mentor" as const,
      full_name: fullName,
      city: city || null,
      years_experience: yearsExperience ? Number(yearsExperience) : null,
      phone,
      about: about || null,
      details: detailsObj
    };
  };

  const handleSaveDraft = async () => {
    if (!token) return;
    setSavingDraft(true);
    try {
      const payload = buildPayload();
      await authenticatedPost("/api/v1/onboarding/applications/draft", token, payload);
      alert("Draft saved successfully!");
      void fetchApplications();
    } catch (err: any) {
      alert("Failed to save draft: " + err.message);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (!token) return;
    if (!fullName.trim() || !phone.trim() || !about.trim()) {
      alert("Please fill all required fields (*) in Step 1 before submitting.");
      setCurrentStep(0);
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      await authenticatedPost("/api/v1/onboarding/applications", token, payload);
      alert("Application submitted successfully under review!");
      void fetchApplications();
    } catch (err: any) {
      alert("Submission failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGs = (val: string) => {
    setGsPreferences((prev) =>
      prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading onboarding application...
      </div>
    );
  }

  if (activeApplication && !isEditing) {
    const status = activeApplication.status;
    return (
      <div className="mx-auto min-h-screen max-w-4xl px-6 py-16">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-surface shadow-xl">
          <div
            className={`h-2.5 w-full ${
              status === "approved"
                ? "bg-emerald-500"
                : status === "pending"
                ? "bg-amber-500"
                : status === "more_info_required"
                ? "bg-indigo-500"
                : "bg-rose-500"
            }`}
          />
          <div className="p-8 md:p-12">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-slate-500">
              Application Status
            </span>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900">
              {status === "approved"
                ? "Approved & Live"
                : status === "pending"
                ? "Under Moderator Review"
                : status === "more_info_required"
                ? "More Information Required"
                : "Changes Requested"}
            </h1>
            <p className="mt-4 text-slate-600 leading-relaxed text-lg">
              {status === "approved"
                ? "Congratulations! Your UPSC Mentor application is approved. You now have full access to your Mentorship Desk workspace."
                : status === "pending"
                ? "Our team is reviewing your marksheets and evaluated answer samples. Verification checks usually complete in 48 hours."
                : status === "more_info_required"
                ? "The admin team requires some more details or clarified credentials to complete your verification. Please review the feedback below and update."
                : "The reviewer requested adjustments to your application. Read the reviewer notes below, update the required fields, and resubmit."}
            </p>

            {activeApplication.reviewer_note && (
              <div className={`mt-8 rounded-2xl p-6 border ${
                status === "more_info_required"
                  ? "border-indigo-100 bg-indigo-50/30 text-indigo-900"
                  : "border-rose-100 bg-rose-50/30 text-rose-900"
              }`}>
                <p className={`text-xs font-bold uppercase tracking-widest ${
                  status === "more_info_required" ? "text-indigo-700" : "text-rose-700"
                }`}>Reviewer Feedback</p>
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">
                  {activeApplication.reviewer_note}
                </p>
              </div>
            )}

            <div className="mt-10 flex flex-wrap gap-4 border-t border-slate-100 pt-8">
              {status === "approved" && (
                <Link
                  href="/mentor/workspace"
                  className="rounded-2xl bg-indigo-600 px-6 py-3.5 font-bold text-white transition hover:bg-indigo-700 shadow-lg shadow-indigo-600/10"
                >
                  Enter Mentor Workspace
                </Link>
              )}
              {(status === "rejected" || status === "more_info_required") && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-2xl bg-indigo-600 px-6 py-3.5 font-bold text-white transition hover:bg-indigo-700 shadow-lg shadow-indigo-600/10"
                >
                  {status === "more_info_required" ? "Provide Details & Resubmit" : "Edit and Resubmit"}
                </button>
              )}
              <Link
                href="/become-mentor"
                className="rounded-2xl border border-slate-200 bg-surface px-6 py-3.5 font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to Portal Info
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding Step Content
  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-surface shadow-xl">
        {/* Stepper Header */}
        <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">
                Step {currentStep + 1} of {STEPS.length}
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-900">{STEPS[currentStep]}</h1>
            </div>
            <div className="flex items-center gap-2">
              {STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 w-10 rounded-full transition-all duration-300 ${
                    idx === currentStep
                      ? "bg-indigo-600"
                      : idx < currentStep
                      ? "bg-emerald-400"
                      : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="p-8">
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="As per Government ID"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Contact Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 90000 00000"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">City / Location</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="New Delhi, India"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Current Occupation
                  </label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="IAS officer (Retd), IAS coach, etc."
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Total Mentorship Experience (Years)
                </label>
                <input
                  type="number"
                  min={0}
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  placeholder="3"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Application Summary / Bio <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Introduce your UPSC credentials, your mentoring achievements, and your teaching style..."
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Headshot Upload */}
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
                <div className="flex items-center gap-4">
                  {headshot?.url ? (
                    <img
                      src={headshot.url}
                      alt="Headshot"
                      className="h-20 w-20 rounded-2xl object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface text-xs font-bold text-slate-400">
                      No Photo
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Professional Headshot</h3>
                    <p className="text-xs text-slate-500">Becomes your profile picture. JPG, PNG or WEBP.</p>
                    <button
                      type="button"
                      disabled={uploadingKind !== null}
                      onClick={() => void handleMockUpload("headshot", "headshot.jpg")}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingKind === "headshot" ? "Uploading..." : "Mock Upload Photo"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    UPSC Roll Number (Verification)
                  </label>
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="0813958"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Years of Attempts</label>
                  <input
                    type="text"
                    value={upscYears}
                    onChange={(e) => setUpscYears(e.target.value)}
                    placeholder="2021, 2023"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Mains Written Count</label>
                  <input
                    type="number"
                    min={0}
                    value={mainsWritten}
                    onChange={(e) => setMainsWritten(e.target.value)}
                    placeholder="2"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    UPSC Interview Faced Count
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={interviewsFaced}
                    onChange={(e) => setInterviewsFaced(e.target.value)}
                    placeholder="1"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* marksheets mock uploads */}
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
                <h3 className="text-sm font-bold text-slate-800">Official UPSC Proofs / Marksheets</h3>
                <p className="text-xs text-slate-500">Attach marksheets showing you cleared Prelims/Mains or faced Interview.</p>
                <div className="mt-4 space-y-2">
                  {proofs.map((proof, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-xl bg-surface border border-slate-200 px-4 py-2 text-xs"
                    >
                      <span className="flex items-center gap-2 text-slate-700">
                        <FileText className="h-4 w-4 text-indigo-500" />
                        {proof.file_name}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold uppercase">Uploaded</span>
                    </div>
                  ))}
                  {proofs.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No files attached yet.</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={uploadingKind !== null}
                  onClick={() => void handleMockUpload("proof", "marksheet_upsc.pdf")}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingKind === "proof" ? "Uploading..." : "Mock Upload Proof"}
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Optional Subject Focus</label>
                <input
                  type="text"
                  value={optionalSubject}
                  onChange={(e) => setOptionalSubject(e.target.value)}
                  placeholder="History, PSIR, Geography, Sociology, etc."
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">General Studies Focus</label>
                <div className="mt-3 flex flex-wrap gap-3">
                  {GS_OPTIONS.map((gs) => {
                    const active = gsPreferences.includes(gs);
                    return (
                      <button
                        key={gs}
                        type="button"
                        onClick={() => toggleGs(gs)}
                        className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                          active
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-surface text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {active && <Check className="h-3.5 w-3.5" />}
                        {gs}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Coaching Institute Associations
                </label>
                <input
                  type="text"
                  placeholder="Vision IAS, Next IAS, Forum IAS (Comma separated)"
                  value={instituteAssociations.join(", ")}
                  onChange={(e) =>
                    setInstituteAssociations(
                      e.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Introduction Video Link
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="YouTube or Google Drive link"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                />
              </div>

              {/* Sample checked evaluation upload */}
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
                <h3 className="text-sm font-bold text-slate-800">Sample Evaluated Mains Answer sheet</h3>
                <p className="text-xs text-slate-500">
                  Upload a PDF copy of an answer sheet you evaluated previously to demonstrate your feedback style.
                </p>
                {sampleEvaluation ? (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-surface border border-slate-200 px-4 py-2 text-xs">
                    <span className="flex items-center gap-2 text-slate-700">
                      <FileText className="h-4 w-4 text-indigo-500" />
                      {sampleEvaluation.file_name}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold uppercase">Uploaded</span>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-slate-400 italic">No file attached yet.</p>
                )}
                <button
                  type="button"
                  disabled={uploadingKind !== null}
                  onClick={() => void handleMockUpload("sample", "sample_mains_evaluation.pdf")}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingKind === "sample" ? "Uploading..." : "Mock Upload Sample"}
                </button>
              </div>
            </div>
          )}

          {/* Review comments on draft/rejected/more_info_required */}
          {(activeApplication?.status === "rejected" || activeApplication?.status === "more_info_required") && activeApplication.reviewer_note && (
            <div className={`mt-6 rounded-2xl p-4 text-xs border ${
              activeApplication.status === "more_info_required"
                ? "bg-indigo-50 border-indigo-100 text-indigo-800"
                : "bg-rose-50 border-rose-100 text-rose-800"
            }`}>
              <span className="font-bold uppercase tracking-wider">
                {activeApplication.status === "more_info_required" ? "More Information Requested:" : "Adjustment requested:"}
              </span>
              <p className="mt-1 leading-relaxed">{activeApplication.reviewer_note}</p>
            </div>
          )}

          {/* Form Actions */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-8">
            <button
              type="button"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-surface px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>

            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={savingDraft || submitting}
                onClick={handleSaveDraft}
                className="rounded-xl border border-slate-200 bg-surface px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {savingDraft ? "Saving..." : "Save Draft"}
              </button>

              {currentStep < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

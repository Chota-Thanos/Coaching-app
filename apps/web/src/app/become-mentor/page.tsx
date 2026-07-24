"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle, GraduationCap, LayoutPanelLeft, ShieldCheck, UserCheck, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "../../components/auth/auth-context";
import { browserBaseUrl } from "../../lib/api";

export default function BecomeMentorPage() {
  const { user, token } = useAuth();
  const [appStatus, setAppStatus] = useState<string | null>(null);

  useEffect(() => {
    if (user && token) {
      fetch(`${browserBaseUrl}/api/v1/onboarding/applications/me`, {
        headers: {
          "accept": "application/json",
          "authorization": `Bearer ${token}`
        }
      })
        .then((res) => res.json())
        .then((data: any[]) => {
          if (data && data.length > 0) {
            setAppStatus(data[0].status);
          }
        })
        .catch((err) => console.error("Failed to fetch application status on landing page", err));
    }
  }, [user, token]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Hero Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 py-20 text-white">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="container relative mx-auto max-w-6xl px-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-indigo-300">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            Join Our Elite Network
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
            Become a <span className="bg-gradient-to-r from-indigo-400 to-sky-300 bg-clip-text text-transparent">UPSC Mentor</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            Share your expertise, grade subjective Mains copies, take 1-on-1 consultations, and guide serious aspirants on their path to success.
          </p>
        </div>
      </header>

      {/* Program Details */}
      <main className="container mx-auto -mt-10 max-w-4xl px-6">
        <div className="rounded-[32px] border border-slate-200 bg-surface p-8 shadow-xl md:p-12">
          <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <div className="space-y-6 md:w-3/5">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <GraduationCap className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900">Mains Expert & Mentor</h2>
              <p className="text-slate-600 leading-relaxed">
                As a verified Mains Expert on our platform, you will help students navigate the complex writing stages of the Civil Services Exam.
              </p>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  Your Key Capabilities
                </h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    Evaluate answer sheet copies uploaded by students
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    Schedule and conduct 1-on-1 video mentorship calls via Agora
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    Provide direct feedback on Optional and GS syllabus preparation
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-6 rounded-3xl bg-slate-50 p-6 md:w-2/5 border border-slate-100">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                Eligibility Criteria
              </h3>
              <p className="text-xs text-slate-500">
                We maintain high-signal quality guidelines. Standard validation criteria apply:
              </p>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                  Must have cleared UPSC Mains or faced the Civil Services Interview.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                  Verification roll number and marksheets are required to apply.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                  A sample checked copy showing your grading feedback style.
                </li>
              </ul>

              {user ? (
                <>
                  {appStatus === "pending" ? (
                    <Link
                      href="/profile/apply"
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 text-center font-bold text-white transition hover:bg-amber-600 shadow-lg shadow-amber-500/10"
                    >
                      <Clock className="h-5 w-5 animate-spin" style={{ animationDuration: '3s' }} />
                      Mentorship Under review
                    </Link>
                  ) : appStatus === "more_info_required" ? (
                    <Link
                      href="/profile/apply"
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-center font-bold text-white transition hover:bg-indigo-700 shadow-lg shadow-indigo-600/10 animate-pulse"
                    >
                      <AlertCircle className="h-5 w-5" />
                      More info required
                    </Link>
                  ) : appStatus === "approved" || user.role === "mentor" ? (
                    <Link
                      href="/mentor/workspace"
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-center font-bold text-white transition hover:bg-emerald-700 shadow-lg shadow-emerald-600/10"
                    >
                      Enter Mentor Workspace
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  ) : (
                    <Link
                      href="/profile/apply?role=mentor"
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-center font-bold text-white transition hover:bg-indigo-700 shadow-lg shadow-indigo-600/10"
                    >
                      {appStatus === "rejected" || appStatus === "draft" ? "Resume Application" : "Apply as Mentor"}
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  )}
                </>
              ) : (
                <Link
                  href="/login?next=/become-mentor"
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-center font-bold text-white transition hover:bg-indigo-700 shadow-lg shadow-indigo-600/10"
                >
                  Sign in to Apply
                  <ArrowRight className="h-5 w-5" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 rounded-[40px] bg-slate-900 p-8 text-white md:p-12">
          <div className="grid gap-10 md:grid-cols-3">
            <div className="space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-indigo-400">
                <UserCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">Verification Desk</h3>
              <p className="text-sm text-slate-400">
                All applications are reviewed by moderators. Credential checks are completed within 48 hours.
              </p>
            </div>
            <div className="space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-indigo-400">
                <LayoutPanelLeft className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">Mentorship Workspace</h3>
              <p className="text-sm text-slate-400">
                Approved mentors get access to a professional workspace to review student requests, schedule video rooms, and edit slots.
              </p>
            </div>
            <div className="space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-emerald-400">
                <span className="text-xl font-black">₹</span>
              </div>
              <h3 className="text-lg font-bold">Fair Returns</h3>
              <p className="text-sm text-slate-400">
                Receive directly credited fees for evaluations and video calls. Pricing structure defaults to INR 1000 per booking.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

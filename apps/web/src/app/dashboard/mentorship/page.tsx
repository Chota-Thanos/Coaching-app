"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from "../../../components/auth/auth-context";
import { Send, Calendar, Video, CheckCircle2, MessageSquare, AlertCircle, FileText, Download, CreditCard, Clock, User, Trash2, Sparkles, Link2 } from "lucide-react";
import Link from "next/link";

type MentorshipMessage = {
  id: number;
  request_id: number;
  sender_id: number;
  body: string;
  created_at: string;
  sender_username: string;
};

type MentorshipRequest = {
  id: number;
  user_id: number;
  mentor_id: number;
  mains_answer_attempt_id: number | null;
  preferred_mode: string;
  note: string | null;
  status: "requested" | "accepted" | "rejected" | "completed" | "cancelled" | "expired";
  scheduled_slot_id: number | null;
  payment_status: "pending" | "paid" | "refunded" | "failed";
  payment_amount: number;
  payment_currency: string;
  meta: {
    offered_slot_ids?: number[];
    student_copy?: { url: string; file_name: string } | null;
  } | null;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  mentor_name: string;
  mentor_meta?: {
    evaluation_source?: "any_source" | "own_questions";
    question_pdfs?: { file_name: string; url: string; path?: string }[];
  } | null;
  mentor_headshot: string | null;
  mentor_email: string;
  session_id: number | null;
  session_starts_at: string | null;
  session_ends_at: string | null;
  session_meeting_link: string | null;
  session_status: string | null;
  
  // Attempt Evaluation fields
  evaluation_status?: "pending" | "ai_evaluating" | "evaluated" | "needs_manual_review";
  evaluation_score?: number | null;
  evaluation_max_score?: number | null;
  evaluation_feedback?: string | null;
  evaluation_checked_copy_url?: string | null;
  evaluation_strengths?: string[] | null;
  evaluation_weaknesses?: string[] | null;
  attempt_answer_file_url?: string | null;
  attempt_student_answer_text?: string | null;
  attempt_question_statement?: string | null;
};

type AvailabilitySlot = {
  id: number;
  mentor_id: number;
  starts_at: string;
  ends_at: string;
  mode: string;
  booked_count: number;
  max_bookings: number;
  title: string | null;
};

export default function LearnerMentorshipPage() {
  const router = useRouter();
  const { user, token, isInitialized } = useAuth();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<MentorshipRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<MentorshipRequest | null>(null);

  // Chat states
  const [messages, setMessages] = useState<MentorshipMessage[]>([]);
  const [typedMessage, setTypedMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Slots states
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  // Agendas states
  const [agendas, setAgendas] = useState<any[]>([]);
  const [newAgendaTitle, setNewAgendaTitle] = useState("");
  const [newAgendaDesc, setNewAgendaDesc] = useState("");
  const [proposingAgenda, setProposingAgenda] = useState(false);

  // Scratchpad state
  const [scratchpad, setScratchpad] = useState("");
  useEffect(() => {
    if (selectedRequest) {
      setScratchpad(localStorage.getItem(`mentorship_scratchpad_${selectedRequest.id}`) || "");
    }
  }, [selectedRequest]);

  const handleScratchpadChange = (val: string) => {
    setScratchpad(val);
    if (selectedRequest) {
      localStorage.setItem(`mentorship_scratchpad_${selectedRequest.id}`, val);
    }
  };

  useEffect(() => {
    if (isInitialized && !user) {
      router.push("/login");
    }
  }, [isInitialized, user, router]);

  const fetchRequests = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await authenticatedGet<MentorshipRequest[]>("/api/v1/mentorship/requests?mode=user", token);
      setRequests(data || []);
      
      // Auto-select first request or preserve selection
      if (data && data.length > 0) {
        if (selectedRequest) {
          const current = data.find((r) => r.id === selectedRequest.id);
          setSelectedRequest(current || data[0] || null);
        } else {
          setSelectedRequest(data[0] || null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (requestId: number) => {
    if (!token) return;
    try {
      const chatLogs = await authenticatedGet<MentorshipMessage[]>(
        `/api/v1/mentorship/requests/${requestId}/messages`,
        token
      );
      setMessages(chatLogs || []);
    } catch (err) {
      console.error("Failed to load chat logs:", err);
    }
  };

  const fetchSlots = async (mentorId: number) => {
    if (!token) return;
    try {
      setLoadingSlots(true);
      const allSlots = await authenticatedGet<AvailabilitySlot[]>(
        `/api/v1/mentorship/slots?mentor_id=${mentorId}&active_only=true`,
        token
      );
      setSlots(allSlots || []);
      if (allSlots && allSlots.length > 0) {
        setSelectedSlotId(String(allSlots[0]?.id || ""));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (token) {
      void fetchRequests();
    }
  }, [token]);

  const fetchAgendas = async (requestId: number) => {
    if (!token) return;
    try {
      const data = await authenticatedGet<any[]>(
        `/api/v1/mentorship/requests/${requestId}/agendas`,
        token
      );
      setAgendas(data || []);
    } catch (err) {
      console.error("Failed to load agendas:", err);
    }
  };

  useEffect(() => {
    if (selectedRequest) {
      void fetchMessages(selectedRequest.id);
      void fetchAgendas(selectedRequest.id);
      
      // If paid and needs slot booking, fetch mentor slots
      if (selectedRequest.payment_status === "paid" && !selectedRequest.scheduled_slot_id) {
        void fetchSlots(selectedRequest.mentor_id);
      } else {
        setSlots([]);
      }

      // Start messages polling
      const timer = setInterval(() => {
        void fetchMessages(selectedRequest.id);
        void fetchAgendas(selectedRequest.id);
      }, 5000);

      return () => clearInterval(timer);
    }
  }, [selectedRequest]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedRequest || !typedMessage.trim()) return;

    setSendingMessage(true);
    try {
      await authenticatedPost(
        `/api/v1/mentorship/requests/${selectedRequest.id}/messages`,
        token,
        { body: typedMessage.trim() }
      );
      setTypedMessage("");
      void fetchMessages(selectedRequest.id);
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handlePayment = async () => {
    if (!token || !selectedRequest) return;
    try {
      await authenticatedPost(`/api/v1/mentorship/requests/${selectedRequest.id}/pay`, token, {});
      alert("Payment successful! You can now book your slot.");
      void fetchRequests();
    } catch (err: any) {
      alert("Payment failed: " + err.message);
    }
  };

  const handleBookSlot = async () => {
    if (!token || !selectedRequest || !selectedSlotId) return;
    try {
      await authenticatedPost(`/api/v1/mentorship/requests/${selectedRequest.id}/book-slot`, token, {
        slot_id: Number(selectedSlotId),
      });
      alert("Slot booked successfully! Your session is scheduled.");
      void fetchRequests();
    } catch (err: any) {
      alert("Booking failed: " + err.message);
    }
  };

  const handleCreateAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedRequest || !newAgendaTitle.trim()) return;
    setProposingAgenda(true);
    try {
      await authenticatedPost(`/api/v1/mentorship/requests/${selectedRequest.id}/agendas`, token, {
        title: newAgendaTitle.trim(),
        description: newAgendaDesc.trim() || undefined
      });
      setNewAgendaTitle("");
      setNewAgendaDesc("");
      void fetchAgendas(selectedRequest.id);
    } catch (err: any) {
      alert("Failed to propose agenda: " + err.message);
    } finally {
      setProposingAgenda(false);
    }
  };

  const handleAgreeAgenda = async (agendaId: number) => {
    if (!token || !selectedRequest) return;
    try {
      await authenticatedPut(`/api/v1/mentorship/agendas/${agendaId}/agree`, token, {});
      void fetchAgendas(selectedRequest.id);
    } catch (err: any) {
      alert("Failed to agree to agenda: " + err.message);
    }
  };

  const handleConfirmSolveAgenda = async (agendaId: number) => {
    if (!token || !selectedRequest) return;
    try {
      await authenticatedPut(`/api/v1/mentorship/agendas/${agendaId}/solve-confirm`, token, {});
      void fetchAgendas(selectedRequest.id);
    } catch (err: any) {
      alert("Failed to confirm solved: " + err.message);
    }
  };

  const handleDeleteAgenda = async (agendaId: number) => {
    if (!token || !selectedRequest) return;
    if (!confirm("Are you sure you want to delete this proposed agenda?")) return;
    try {
      await authenticatedDelete(`/api/v1/mentorship/agendas/${agendaId}`, token);
      void fetchAgendas(selectedRequest.id);
    } catch (err: any) {
      alert("Failed to delete agenda: " + err.message);
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading requests desk...
      </div>
    );
  }

  const isCopyEvaluated = selectedRequest?.mains_answer_attempt_id && selectedRequest?.evaluation_status === "evaluated";

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-10">
      <div className="container mx-auto max-w-6xl px-6">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <MessageSquare className="h-8 w-8 text-indigo-600" />
              Mentorship Desk
            </h1>
            <p className="text-slate-500 text-sm">
              Manage your requests, chat with mentors, download evaluations, and book video slots.
            </p>
          </div>
          <Link href="/mentors" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700">
            Find Mentors
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-[40px] border border-dashed border-slate-300 bg-white p-20 text-center">
            <User className="mx-auto h-16 w-16 text-slate-300 mb-4 animate-pulse" />
            <h2 className="text-xl font-bold text-slate-800">No active requests</h2>
            <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
              You haven't submitted any mentorship requests yet. Browse our marketplace to get started.
            </p>
            <Link href="/mentors" className="mt-6 inline-block rounded-2xl bg-indigo-600 px-6 py-3.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700">
              Browse UPSC Mentors
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
            {/* Sidebar list */}
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                Your Requests ({requests.length})
              </h2>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {requests.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className={`w-full text-left rounded-3xl p-5 border transition-all ${
                      selectedRequest?.id === req.id
                        ? "border-indigo-600 bg-indigo-50/40 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-3 justify-between">
                      <div className="flex items-center gap-3">
                        {req.mentor_headshot ? (
                          <img
                            src={req.mentor_headshot}
                            alt={req.mentor_name}
                            className="h-10 w-10 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold text-sm">
                            {req.mentor_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-slate-800 text-xs sm:text-sm line-clamp-1">{req.mentor_name}</h3>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${
                            req.status === "accepted" ? "text-indigo-600" : req.status === "rejected" ? "text-rose-500" : "text-slate-400"
                          }`}>
                            {req.status}
                          </span>
                        </div>
                      </div>

                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        req.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {req.payment_status === "paid" ? "Paid" : "Unpaid"}
                      </span>
                    </div>

                    {req.session_starts_at && (
                      <div className="mt-4 flex items-center gap-1.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50/60 p-2 rounded-xl">
                        <Calendar className="h-3.5 w-3.5" />
                        Slot: {new Date(req.session_starts_at).toLocaleString()}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Request Triage & chat panel */}
            {selectedRequest && (
              <div className="space-y-6">
                {/* Status card */}
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected Mentor</span>
                    <h2 className="text-xl font-black text-slate-900">{selectedRequest.mentor_name}</h2>
                    <p className="text-xs text-slate-500">Preferred Mode: {selectedRequest.preferred_mode === "video" ? "Video Consultation" : "Chat Only"}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Action conditional based on request status */}
                    {selectedRequest.status === "accepted" && selectedRequest.payment_status === "pending" && (
                      <div className="flex flex-col items-end gap-1.5">
                        <button
                          onClick={handlePayment}
                          disabled={agendas.some((a) => a.status === "proposed")}
                          className="rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700 flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                          <CreditCard className="h-4 w-4" />
                          Pay & Book Session (₹1000)
                        </button>
                        {agendas.some((a) => a.status === "proposed") && (
                          <span className="text-[10px] text-rose-500 font-semibold">
                            Agreement on all proposed agendas required
                          </span>
                        )}
                      </div>
                    )}

                    {selectedRequest.payment_status === "paid" && !selectedRequest.scheduled_slot_id && (
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <select
                          value={selectedSlotId}
                          onChange={(e) => setSelectedSlotId(e.target.value)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none font-bold text-slate-700 cursor-pointer"
                        >
                          {slots.length === 0 ? (
                            <option>No slots offered yet</option>
                          ) : (
                            slots.map((s) => (
                              <option key={s.id} value={s.id}>
                                {new Date(s.starts_at).toLocaleString()}
                              </option>
                            ))
                          )}
                        </select>
                        <button
                          onClick={handleBookSlot}
                          disabled={slots.length === 0}
                          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 shrink-0"
                        >
                          Confirm Slot
                        </button>
                      </div>
                    )}

                    {selectedRequest.scheduled_slot_id && selectedRequest.session_id && (
                      <Link
                        href={`/mentorship/session/${selectedRequest.session_id}`}
                        className="rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white hover:bg-indigo-700 flex items-center gap-1.5 transition animate-pulse"
                      >
                        <Video className="h-4 w-4" />
                        Join Call Room
                      </Link>
                    )}
                  </div>
                </div>

                 {/* Custom copy evaluation view */}
                 {!selectedRequest.mains_answer_attempt_id && selectedRequest.meta?.student_copy && (
                   <div className="rounded-[32px] border border-indigo-100 bg-indigo-50/10 p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
                     <div className="flex items-center justify-between border-b border-indigo-50/50 pb-3">
                       <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                         <FileText className="h-4 w-4 text-indigo-600" />
                         Uploaded answer copy
                       </h3>
                       <span className="rounded-xl bg-indigo-100 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                         External Copy
                       </span>
                     </div>

                     <div className="flex items-start gap-3 text-xs text-slate-500">
                       <FileText className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                       <div>
                         <p className="font-bold text-slate-700">{selectedRequest.meta.student_copy.file_name}</p>
                         <a
                           href={selectedRequest.meta.student_copy.url}
                           target="_blank"
                           rel="noreferrer"
                           className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                         >
                           View Uploaded PDF Submission
                         </a>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Mentor Question Sets if evaluation_source === "own_questions" */}
                 {selectedRequest.mentor_meta?.evaluation_source === "own_questions" && (
                   <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
                     <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                       <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                         <Sparkles className="h-4 w-4 text-indigo-600" />
                         Required Mentor Question Sets
                       </h3>
                     </div>
                     
                     <p className="text-[11px] text-slate-500">
                       This mentor only evaluates answer copies on their own specific set of questions:
                     </p>

                     <div className="grid gap-2">
                       {selectedRequest.mentor_meta.question_pdfs?.map((q: any, idx: number) => {
                         const isPaid = selectedRequest.payment_status === "paid" || ["accepted", "completed"].includes(selectedRequest.status);
                         return (
                           <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                             <span className="font-bold text-slate-700">{q.file_name}</span>
                             {isPaid ? (
                               <a
                                 href={q.url}
                                 target="_blank"
                                 rel="noreferrer"
                                 className="rounded-full bg-indigo-600 text-white px-3 py-1 text-[10px] font-bold hover:bg-indigo-700 transition"
                               >
                                 Download Question PDF
                               </a>
                             ) : (
                               <span className="rounded-full bg-slate-200 text-slate-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                                 🔒 Locked until payment
                               </span>
                             )}
                           </div>
                         );
                       })}
                       {(!selectedRequest.mentor_meta.question_pdfs || selectedRequest.mentor_meta.question_pdfs.length === 0) && (
                         <p className="text-xs text-slate-400 italic">No question sets configured by this mentor yet.</p>
                       )}
                     </div>
                   </div>
                 )}

                {/* Journey B: Copy Evaluation Status */}
                {selectedRequest.mains_answer_attempt_id && (
                  <div className="rounded-[32px] border border-indigo-100 bg-indigo-50/10 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-indigo-50/50 pb-3">
                      <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-indigo-600" />
                        Linked subjective evaluation
                      </h3>
                      <span className={`rounded-xl px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        isCopyEvaluated ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {selectedRequest.evaluation_status}
                      </span>
                    </div>

                    {!isCopyEvaluated ? (
                      <div className="flex items-start gap-3 text-xs text-slate-500">
                        <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-700">Evaluation is pending</p>
                          <p className="mt-0.5">The mentor is currently reviewing your uploaded copy and will provide evaluation marks and strengths/weaknesses shortly.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Score Obtained</span>
                            <p className="text-2xl font-black text-slate-800 mt-1">
                              {selectedRequest.evaluation_score} <span className="text-xs text-slate-500 font-semibold">/ {selectedRequest.evaluation_max_score}</span>
                            </p>
                          </div>
                          
                          {selectedRequest.evaluation_checked_copy_url && (
                            <a
                              href={selectedRequest.evaluation_checked_copy_url}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-indigo-50/40 hover:bg-indigo-50 rounded-2xl border border-indigo-100/50 p-4 text-center flex flex-col justify-center items-center gap-1 transition"
                            >
                              <Download className="h-5 w-5 text-indigo-600" />
                              <span className="text-xs font-bold text-indigo-950">Checked Copy PDF</span>
                            </a>
                          )}
                        </div>

                        {selectedRequest.evaluation_feedback && (
                          <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-600">
                            <p className="font-bold text-slate-800 mb-1">Mentor Feedback Note</p>
                            <p className="leading-relaxed whitespace-pre-line">{selectedRequest.evaluation_feedback}</p>
                          </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/20 p-4">
                            <h4 className="text-[10px] font-black uppercase text-emerald-800 tracking-wider mb-2">Strengths Identified</h4>
                            <ul className="space-y-1.5 text-xs text-slate-600">
                              {selectedRequest.evaluation_strengths?.map((s, idx) => (
                                <li key={idx} className="flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span>{s}</span>
                                </li>
                              ))}
                              {(!selectedRequest.evaluation_strengths || selectedRequest.evaluation_strengths.length === 0) && (
                                <li className="italic text-slate-400">None specified</li>
                              )}
                            </ul>
                          </div>
                          
                          <div className="rounded-2xl border border-rose-100 bg-rose-50/20 p-4">
                            <h4 className="text-[10px] font-black uppercase text-rose-800 tracking-wider mb-2">Areas for Improvement</h4>
                            <ul className="space-y-1.5 text-xs text-slate-600">
                              {selectedRequest.evaluation_weaknesses?.map((w, idx) => (
                                <li key={idx} className="flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                                  <span>{w}</span>
                                </li>
                              ))}
                              {(!selectedRequest.evaluation_weaknesses || selectedRequest.evaluation_weaknesses.length === 0) && (
                                <li className="italic text-slate-400">None specified</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Agendas Checklist Panel */}
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                      <FileText className="h-5 w-5 text-indigo-600" />
                      Mentorship Request Agendas ({agendas.length})
                    </h3>
                    {selectedRequest.payment_status === "pending" && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                        Agreement Required Before Payment
                      </span>
                    )}
                    {selectedRequest.payment_status === "paid" && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        Active Tracker
                      </span>
                    )}
                  </div>

                  {selectedRequest.payment_status === "pending" && agendas.some((a) => a.status === "proposed") && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/10 p-4 flex gap-2.5 items-start text-xs text-amber-800 leading-normal">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Proposed Agendas Pending Agreement</p>
                        <p className="mt-0.5">Please review and agree to the proposed agendas below. You cannot make payment until all proposed agendas are agreed to by both parties.</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {agendas.map((agenda) => {
                      const isCreatorMe = Number(agenda.created_by) === user?.id;
                      const statusColors: Record<string, string> = {
                        proposed: "bg-amber-100 text-amber-800 border-amber-200",
                        agreed: "bg-indigo-100 text-indigo-800 border-indigo-200",
                        solved_proposed: "bg-orange-100 text-orange-800 border-orange-200 animate-pulse",
                        solved: "bg-emerald-100 text-emerald-800 border-emerald-200"
                      };
                      const statusLabels: Record<string, string> = {
                        proposed: "Proposed",
                        agreed: "Agreed",
                        solved_proposed: "Solved (Waiting for your confirmation)",
                        solved: "Solved & Confirmed"
                      };

                      return (
                        <div key={agenda.id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-3 transition hover:bg-white hover:border-slate-200 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-extrabold text-slate-800 text-xs">{agenda.title}</h4>
                              {agenda.description && (
                                <p className="text-[11px] text-slate-500 mt-1 leading-normal">{agenda.description}</p>
                              )}
                              <p className="text-[9px] text-slate-400 mt-1.5">
                                Proposed by: {isCreatorMe ? "You" : agenda.creator_username || "Mentor"} · Status: 
                                <span className={`inline-block ml-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border ${statusColors[agenda.status]}`}>
                                  {statusLabels[agenda.status]}
                                </span>
                              </p>
                              {agenda.meta?.attached_question && (
                                <div className="mt-2">
                                  <a
                                    href={agenda.meta.attached_question.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100"
                                  >
                                    <FileText className="h-3 w-3 text-indigo-600 shrink-0" />
                                    Attached Question: {agenda.meta.attached_question.file_name}
                                  </a>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Agree Button */}
                              {agenda.status === "proposed" && !isCreatorMe && (
                                <button
                                  type="button"
                                  onClick={() => handleAgreeAgenda(agenda.id)}
                                  className="rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-black text-white hover:bg-indigo-700 transition"
                                >
                                  Agree
                                </button>
                              )}

                              {/* Confirm Solved Button */}
                              {agenda.status === "solved_proposed" && (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmSolveAgenda(agenda.id)}
                                  className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-black text-white hover:bg-emerald-700 transition"
                                >
                                  Confirm Solved
                                </button>
                              )}

                              {/* Delete Button */}
                              {agenda.status === "proposed" && isCreatorMe && selectedRequest.payment_status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAgenda(agenda.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 transition"
                                  title="Delete Agenda"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {agendas.length === 0 && (
                      <p className="text-xs text-slate-400 italic text-center py-4">No agendas proposed yet.</p>
                    )}
                  </div>

                  {/* Propose agenda form */}
                  {selectedRequest.payment_status === "pending" && (
                    <form onSubmit={handleCreateAgenda} className="border-t border-slate-100 pt-4 space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">Propose Mentorship Deliverable / Agenda Query</span>
                      <div className="space-y-2">
                        <input
                          type="text"
                          required
                          value={newAgendaTitle}
                          onChange={(e) => setNewAgendaTitle(e.target.value)}
                          placeholder="e.g. Can you review my Essay writing structure?"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                        />
                        <textarea
                          rows={2}
                          value={newAgendaDesc}
                          onChange={(e) => setNewAgendaDesc(e.target.value)}
                          placeholder="Provide optional detail or explanation..."
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500 resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={proposingAgenda}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600 transition disabled:opacity-50"
                      >
                        {proposingAgenda ? "Proposing..." : "Propose Agenda"}
                      </button>
                    </form>
                  )}
                </div>

                {/* Segmented Chat System */}
                {selectedRequest.payment_status === "paid" ? (
                  /* Post-Payment Premium Mentorship Room */
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
                    {/* Chat Area (occupies 2 cols) */}
                    <div className="lg:col-span-2 rounded-[32px] border border-indigo-150 bg-white shadow-sm overflow-hidden flex flex-col h-[480px]">
                      {/* Header */}
                      <div className="border-b border-indigo-55 bg-indigo-50/40 px-6 py-4 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                            <MessageSquare className="h-4 w-4 text-indigo-600 animate-pulse" />
                            Premium Mentorship Chat Room
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Your active space for live meetings, deliverables, and resource coordination.</span>
                        </div>
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-100 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      </div>

                      {/* Messages list */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {messages.length === 0 ? (
                          <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">
                            No messages yet. Send a message to start coordinating with your mentor.
                          </div>
                        ) : (
                          messages.map((msg) => {
                            const isMe = msg.sender_id === user?.id;
                            return (
                              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                <span className="text-[10px] text-slate-400 font-semibold mb-1">
                                  {isMe ? "You" : msg.sender_username} · {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs leading-normal whitespace-pre-wrap shadow-sm ${
                                  isMe
                                    ? "bg-indigo-600 text-white rounded-tr-none"
                                    : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50"
                                }`}>
                                  {msg.body}
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={chatBottomRef} />
                      </div>

                      {/* Message Input */}
                      <form onSubmit={handleSendMessage} className="border-t border-slate-100 p-4 flex gap-2 bg-slate-50/50">
                        <input
                          type="text"
                          placeholder="Type a message to coordinate with your mentor..."
                          value={typedMessage}
                          onChange={(e) => setTypedMessage(e.target.value)}
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={sendingMessage || !typedMessage.trim()}
                          className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50 flex items-center justify-center shrink-0 transition"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </form>
                    </div>

                    {/* Premium Sidebar (occupies 1 col) */}
                    <div className="space-y-4 flex flex-col h-[480px]">
                      {/* Deliverables Progress Bar */}
                      {(() => {
                        const trackableAgendas = agendas.filter(a => ["agreed", "solved_proposed", "solved"].includes(a.status));
                        const solvedAgendas = agendas.filter(a => ["solved_proposed", "solved"].includes(a.status));
                        const totalCount = trackableAgendas.length;
                        const solvedCount = solvedAgendas.length;
                        const percentage = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;
                        return (
                          <div className="rounded-2xl border border-indigo-105 bg-white p-4 shadow-sm space-y-2">
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-indigo-950">Deliverables Progress</h4>
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                              <span>Agendas Solved</span>
                              <span>{solvedCount}/{totalCount} ({percentage}%)</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Call Schedule Status */}
                      {selectedRequest.scheduled_slot_id && selectedRequest.session_id && (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/20 p-4 shadow-sm space-y-3">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Call Schedule</h4>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-805">Next Upcoming Slot</p>
                            <p className="text-[10px] text-slate-500 font-semibold">
                              {selectedRequest.session_starts_at ? new Date(selectedRequest.session_starts_at).toLocaleString() : "Date pending"}
                            </p>
                          </div>
                          <Link
                            href={`/mentorship/session/${selectedRequest.session_id}`}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                          >
                            <Video className="h-3.5 w-3.5" />
                            Join Call Room
                          </Link>
                        </div>
                      )}

                      {/* Shared Resources Link Index */}
                      {(() => {
                        const extractUrls = (text: string) => {
                          const urlRegex = /(https?:\/\/[^\s]+)/g;
                          return text.match(urlRegex) || [];
                        };
                        const sharedLinks = Array.from(
                          new Set(
                            messages
                              .flatMap(msg => extractUrls(msg.body))
                              .map(url => url.replace(/[.,;!?]$/, "")) // remove trailing punctuation
                          )
                        );
                        return (
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2 flex-1 flex flex-col overflow-hidden">
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1 shrink-0">
                              <Link2 className="h-3.5 w-3.5 text-indigo-500" />
                              Shared Resources ({sharedLinks.length})
                            </h4>
                            <div className="overflow-y-auto space-y-1.5 pr-1 text-xs flex-1">
                              {sharedLinks.map((link, idx) => {
                                let displayLink = link;
                                try {
                                  const urlObj = new URL(link);
                                  displayLink = urlObj.hostname + (urlObj.pathname.length > 15 ? urlObj.pathname.substring(0, 12) + "..." : urlObj.pathname);
                                } catch {}
                                return (
                                  <a
                                    key={idx}
                                    href={link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-[11px] font-bold text-slate-650 truncate transition-all"
                                    title={link}
                                  >
                                    {displayLink}
                                  </a>
                                );
                              })}
                              {sharedLinks.length === 0 && (
                                <p className="text-[10px] text-slate-400 italic text-center py-4">No shared links in this chat yet.</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Active Workspace Scratchpad */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2 shrink-0">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">Scratchpad</h4>
                        <textarea
                          value={scratchpad}
                          onChange={(e) => handleScratchpadChange(e.target.value)}
                          placeholder="Capture notes, action items, or session goals here..."
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-medium outline-none focus:border-indigo-500 bg-slate-50/50 resize-none h-20"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Pre-Payment Pre-Payment Agenda Coordination Chat */
                  <div className="rounded-[32px] border border-amber-250/70 bg-white shadow-sm overflow-hidden flex flex-col h-[480px] animate-in fade-in duration-200">
                    <div className="border-b border-amber-100 bg-amber-50/40 px-6 py-4 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                          <MessageSquare className="h-4 w-4 text-amber-600 animate-pulse" />
                          Pre-Payment Agenda Coordination
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Discuss the scope of your mentorship, clarify preparation focus, and align on deliverables before paying.</span>
                      </div>
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold border border-amber-100">Coordination</span>
                    </div>

                    {/* Messages list */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {messages.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400 italic text-center px-4">
                          Start Coordinating! Discuss goals, scope and propose deliverables with the mentor here.
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isMe = msg.sender_id === user?.id;
                          return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                              <span className="text-[10px] text-slate-400 font-semibold mb-1">
                                {isMe ? "You" : msg.sender_username} · {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs leading-normal whitespace-pre-wrap shadow-sm ${
                                isMe
                                  ? "bg-amber-100 text-amber-800 border border-amber-200/50 rounded-tr-none"
                                  : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50"
                              }`}>
                                {msg.body}
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Message Input */}
                    <form onSubmit={handleSendMessage} className="border-t border-slate-100 p-4 flex gap-2 bg-slate-50/50">
                      <input
                        type="text"
                        placeholder="Type a message to coordinate with your mentor..."
                        value={typedMessage}
                        onChange={(e) => setTypedMessage(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      />
                      <button
                        type="submit"
                        disabled={sendingMessage || !typedMessage.trim()}
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center shrink-0 transition"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from "../../../components/auth/auth-context";
import { Calendar, Video, MessageSquare, FileText, Download, CreditCard, Clock, User, Sparkles } from "lucide-react";
import Link from "next/link";
import { MentorshipLifecycleTracker } from "../../../components/mentorship/lifecycle-tracker";
import { AgendaPanel } from "../../../components/mentorship/agenda-panel";
import { ChatThread } from "../../../components/mentorship/chat-thread";
import { PremiumSidePanel } from "../../../components/mentorship/premium-side-panel";

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
    evaluation?: {
      score: number;
      max_score: number;
      feedback: string | null;
      checked_copy_url: string | null;
      checked_copy_file_name: string | null;
      strengths: string[];
      weaknesses: string[];
      evaluated_by_user_id: number;
      evaluated_at: string;
    } | null;
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

  const [payingNow, setPayingNow] = useState(false);

  const handlePayment = async () => {
    if (!token || !selectedRequest) return;
    setPayingNow(true);
    try {
      const order = await authenticatedPost<{
        order_id: string;
        currency: string;
        amount: number;
        key_id: string;
        simulated: boolean;
      }>(`/api/v1/mentorship/requests/${selectedRequest.id}/payment/order`, token, {});

      const verify = async (payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        await authenticatedPost(`/api/v1/mentorship/requests/${selectedRequest.id}/payment/verify`, token, payload);
        alert("Payment successful! You can now book your slot.");
        void fetchRequests();
      };

      if (order.simulated) {
        await verify({
          razorpay_order_id: order.order_id,
          razorpay_payment_id: `sim_pay_${Date.now()}`,
          razorpay_signature: "simulated_signature"
        });
      } else {
        const rzp = new (window as any).Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: "WayToIAS Mentorship",
          description: `Consultation with ${selectedRequest.mentor_name}`,
          order_id: order.order_id,
          handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            void verify(response);
          },
          prefill: { name: user?.username, email: user?.email },
          theme: { color: "#4f46e5" }
        });
        rzp.open();
      }
    } catch (err: any) {
      alert("Payment failed: " + err.message);
    } finally {
      setPayingNow(false);
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
  const customEvaluation = selectedRequest?.meta?.evaluation;

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
                {/* Lifecycle tracker */}
                <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
                  <MentorshipLifecycleTracker
                    input={{
                      status: selectedRequest.status,
                      payment_status: selectedRequest.payment_status,
                      scheduled_slot_id: selectedRequest.scheduled_slot_id,
                      session_id: selectedRequest.session_id,
                      mains_answer_attempt_id: selectedRequest.mains_answer_attempt_id,
                      evaluation_status: selectedRequest.evaluation_status,
                      meta: selectedRequest.meta,
                      agendas
                    }}
                  />
                </div>

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
                          disabled={payingNow || agendas.some((a) => a.status === "proposed")}
                          className="rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700 flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                          <CreditCard className="h-4 w-4" />
                          {payingNow ? "Processing..." : "Pay & Book Session (₹1000)"}
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
                         <p className="font-bold text-slate-700">{selectedRequest.meta?.student_copy?.file_name}</p>
                         <a
                           href={selectedRequest.meta?.student_copy?.url}
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

                 {/* Custom copy evaluation status -- mirrors "Linked subjective evaluation" below,
                     for requests that used a directly-uploaded copy instead of a platform attempt */}
                 {!selectedRequest.mains_answer_attempt_id && selectedRequest.meta?.student_copy && (
                   <div className="rounded-[32px] border border-indigo-100 bg-indigo-50/10 p-6 shadow-sm space-y-4">
                     <div className="flex items-center justify-between border-b border-indigo-50/50 pb-3">
                       <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                         <FileText className="h-4 w-4 text-indigo-600" />
                         Copy evaluation
                       </h3>
                       <span className={`rounded-xl px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                         customEvaluation ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                       }`}>
                         {customEvaluation ? "evaluated" : "pending"}
                       </span>
                     </div>

                     {!customEvaluation ? (
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
                               {customEvaluation.score} <span className="text-xs text-slate-500 font-semibold">/ {customEvaluation.max_score}</span>
                             </p>
                           </div>

                           {customEvaluation.checked_copy_url && (
                             <a
                               href={customEvaluation.checked_copy_url}
                               target="_blank"
                               rel="noreferrer"
                               className="bg-indigo-50/40 hover:bg-indigo-50 rounded-2xl border border-indigo-100/50 p-4 text-center flex flex-col justify-center items-center gap-1 transition"
                             >
                               <Download className="h-5 w-5 text-indigo-600" />
                               <span className="text-xs font-bold text-indigo-950">Checked Copy PDF</span>
                             </a>
                           )}
                         </div>

                         {customEvaluation.feedback && (
                           <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-600">
                             <p className="font-bold text-slate-800 mb-1">Mentor Feedback Note</p>
                             <p className="leading-relaxed whitespace-pre-line">{customEvaluation.feedback}</p>
                           </div>
                         )}

                         <div className="grid gap-4 md:grid-cols-2">
                           <div className="rounded-2xl border border-emerald-100 bg-emerald-50/20 p-4">
                             <h4 className="text-[10px] font-black uppercase text-emerald-800 tracking-wider mb-2">Strengths Identified</h4>
                             <ul className="space-y-1.5 text-xs text-slate-600">
                               {customEvaluation.strengths?.map((s, idx) => (
                                 <li key={idx} className="flex items-center gap-1.5">
                                   <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                   <span>{s}</span>
                                 </li>
                               ))}
                               {(!customEvaluation.strengths || customEvaluation.strengths.length === 0) && (
                                 <li className="italic text-slate-400">None specified</li>
                               )}
                             </ul>
                           </div>

                           <div className="rounded-2xl border border-rose-100 bg-rose-50/20 p-4">
                             <h4 className="text-[10px] font-black uppercase text-rose-800 tracking-wider mb-2">Areas for Improvement</h4>
                             <ul className="space-y-1.5 text-xs text-slate-600">
                               {customEvaluation.weaknesses?.map((w, idx) => (
                                 <li key={idx} className="flex items-center gap-1.5">
                                   <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                                   <span>{w}</span>
                                 </li>
                               ))}
                               {(!customEvaluation.weaknesses || customEvaluation.weaknesses.length === 0) && (
                                 <li className="italic text-slate-400">None specified</li>
                               )}
                             </ul>
                           </div>
                         </div>
                       </div>
                     )}
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
                <AgendaPanel
                  agendas={agendas}
                  currentUserId={user?.id}
                  viewerRole="student"
                  paymentStatus={selectedRequest.payment_status}
                  isClosed={["completed", "rejected", "cancelled", "expired"].includes(selectedRequest.status)}
                  icon={<FileText className="h-5 w-5 text-indigo-600" />}
                  proposing={proposingAgenda}
                  newTitle={newAgendaTitle}
                  newDesc={newAgendaDesc}
                  onTitleChange={setNewAgendaTitle}
                  onDescChange={setNewAgendaDesc}
                  onSubmitPropose={handleCreateAgenda}
                  onAgree={handleAgreeAgenda}
                  onConfirmSolve={handleConfirmSolveAgenda}
                  onDelete={handleDeleteAgenda}
                  titlePlaceholder="e.g. Can you review my Essay writing structure?"
                  emptyStateText="No agendas proposed yet."
                />

                {/* Segmented Chat System */}
                {selectedRequest.payment_status === "paid" ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
                    <div className="lg:col-span-2">
                      <ChatThread
                        messages={messages}
                        currentUserId={user?.id}
                        typedMessage={typedMessage}
                        onTypedMessageChange={setTypedMessage}
                        onSubmit={handleSendMessage}
                        sending={sendingMessage}
                        bottomRef={chatBottomRef}
                        theme="indigo"
                        title="Premium Mentorship Chat Room"
                        subtitle="Your active space for live meetings, deliverables, and resource coordination."
                        badgeLabel="Active"
                        emptyStateText="No messages yet. Send a message to start coordinating with your mentor."
                        inputPlaceholder="Type a message to coordinate with your mentor..."
                      />
                    </div>
                    <PremiumSidePanel
                      agendas={agendas}
                      messages={messages}
                      scheduledSlotId={selectedRequest.scheduled_slot_id}
                      sessionId={selectedRequest.session_id}
                      sessionStartsAt={selectedRequest.session_starts_at}
                      scratchpad={scratchpad}
                      onScratchpadChange={handleScratchpadChange}
                    />
                  </div>
                ) : (
                  <ChatThread
                    messages={messages}
                    currentUserId={user?.id}
                    typedMessage={typedMessage}
                    onTypedMessageChange={setTypedMessage}
                    onSubmit={handleSendMessage}
                    sending={sendingMessage}
                    bottomRef={chatBottomRef}
                    theme="amber"
                    title="Pre-Payment Agenda Coordination"
                    subtitle="Discuss the scope of your mentorship, clarify preparation focus, and align on deliverables before paying."
                    badgeLabel="Coordination"
                    emptyStateText="Start Coordinating! Discuss goals, scope and propose deliverables with the mentor here."
                    inputPlaceholder="Type a message to coordinate with your mentor..."
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

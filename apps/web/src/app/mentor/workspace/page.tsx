"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, authenticatedGet, authenticatedPost, authenticatedPut, authenticatedPatch, authenticatedDelete } from "../../../components/auth/auth-context";
import { browserBaseUrl } from "../../../lib/api";
import { Calendar, Video, CheckCircle2, MessageSquare, AlertCircle, FileText, Upload, Plus, Trash2, ArrowRight, Sparkles, LayoutDashboard, Settings, User, ClipboardList, LogOut, Globe, Bell } from "lucide-react";
import { MentorshipLifecycleTracker } from "../../../components/mentorship/lifecycle-tracker";
import { AgendaPanel } from "../../../components/mentorship/agenda-panel";
import { ChatThread } from "../../../components/mentorship/chat-thread";
import { PremiumSidePanel } from "../../../components/mentorship/premium-side-panel";
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
  learner_name: string | null;
  learner_email: string | null;
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
  meeting_link: string | null;
  title: string | null;
  description: string | null;
  is_active: boolean;
};

export default function MentorWorkspacePage() {
  const router = useRouter();
  const { user, token, isInitialized, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<MentorshipRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<MentorshipRequest | null>(null);

  // Chat states
  const [messages, setMessages] = useState<MentorshipMessage[]>([]);
  const [typedMessage, setTypedMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Availability Slots states
  const [mySlots, setMySlots] = useState<AvailabilitySlot[]>([]);
  const [slotDate, setSlotDate] = useState("");
  const [slotStartTime, setSlotStartTime] = useState("");
  const [slotEndTime, setSlotEndTime] = useState("");
  const [creatingSlot, setCreatingSlot] = useState(false);

  // Evaluation Form states
  const [score, setScore] = useState("7");
  const [maxScore, setMaxScore] = useState("10");
  const [feedback, setFeedback] = useState("");
  const [strengthsRaw, setStrengthsRaw] = useState("Strong structure, clear thesis statement");
  const [weaknessesRaw, setWeaknessesRaw] = useState("Lacks specific data points in section 2");
  const [checkedCopyUrl, setCheckedCopyUrl] = useState("");
  const [checkedCopyFileName, setCheckedCopyFileName] = useState("");
  const [uploadingCopy, setUploadingCopy] = useState(false);
  const [submittingEvaluation, setSubmittingEvaluation] = useState(false);

  // Offer slots selection state
  const [selectedOffers, setSelectedOffers] = useState<number[]>([]);

  const [activeTab, setActiveTab] = useState<"overview" | "requests" | "calendar" | "profile" | "settings">("overview");

  // Notifications states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  // Profile form states
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [yearsExp, setYearsExp] = useState("0");
  const [city, setCity] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [education, setEducation] = useState("");
  const [specializationTags, setSpecializationTags] = useState("");
  const [highlights, setHighlights] = useState("");
  const [credentials, setCredentials] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [agendas, setAgendas] = useState<any[]>([]);
  const [newAgendaTitle, setNewAgendaTitle] = useState("");
  const [newAgendaDesc, setNewAgendaDesc] = useState("");
  const [proposingAgenda, setProposingAgenda] = useState(false);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [customExamText, setCustomExamText] = useState("");
  const [specializationType, setSpecializationType] = useState<"all_areas" | "specific_field">("all_areas");
  const [mentorType, setMentorType] = useState<"evaluation_mentorship" | "only_mentorship">("evaluation_mentorship");
  const [adminSpecs, setAdminSpecs] = useState<string[]>([]);
  const [dynamicExams, setDynamicExams] = useState<string[]>(["UPSC CSE", "UPPSC", "BPSC", "MPSC"]);
  const [evaluationSource, setEvaluationSource] = useState<"any_source" | "own_questions">("any_source");
  const [questionPdfs, setQuestionPdfs] = useState<{ file_name: string; url: string; path?: string }[]>([]);
  const [uploadingQuestion, setUploadingQuestion] = useState(false);
  const [selectedAgendaQuestionIndex, setSelectedAgendaQuestionIndex] = useState<string>("");

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

  // Settings states
  const [isPublic, setIsPublic] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchMyProfile = async () => {
    if (!token || !user) return;
    try {
      const data = await authenticatedGet<any>(`/api/v1/mentorship/profiles/${user.id}`, token);
      if (data) {
        setDisplayName(data.display_name || "");
        setHeadline(data.headline || "");
        setBio(data.bio || "");
        setYearsExp(data.years_experience !== null ? String(data.years_experience) : "0");
        setCity(data.city || "");
        setProfileImage(data.profile_image_url || "");
        setPublicEmail(data.public_email || "");
        setEducation(data.education || "");
        setIsPublic(data.is_public !== undefined ? data.is_public : true);
        setIsActive(data.is_active !== undefined ? data.is_active : true);
        setSpecializationTags(data.specialization_tags?.join(", ") || "");
        setHighlights(data.highlights?.join("\n") || "");
        setCredentials(data.credentials?.join("\n") || "");
        setSpecializationType(data.specialization_type || "all_areas");
        setMentorType(data.mentor_type || "evaluation_mentorship");
        setSelectedExams(data.exams || []);
        setAdminSpecs(data.specifications || []);
        const meta = data.meta || {};
        setEvaluationSource(meta.evaluation_source || "any_source");
        setQuestionPdfs(meta.question_pdfs || []);
      }
    } catch (err) {
      console.error("Failed to load mentor profile:", err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const expNum = Number(yearsExp);
    if (isNaN(expNum) || expNum < 0 || expNum > 60 || !Number.isInteger(expNum)) {
      alert("Mentorship experience must be a valid non-negative integer (between 0 and 60).");
      return;
    }
    const tagsList = specializationType === "specific_field"
      ? specializationTags.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    if (specializationType === "specific_field" && tagsList.length === 0) {
      alert("Please specify your specialization focus tags (e.g. GS4 Ethics, Essay, Public Administration).");
      return;
    }
    setSavingProfile(true);
    try {
      const payload = {
        display_name: displayName.trim(),
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        years_experience: expNum,
        city: city.trim() || null,
        profile_image_url: profileImage.trim() || null,
        public_email: publicEmail.trim() || null,
        education: education.trim() || null,
        specialization_tags: tagsList,
        highlights: highlights.split("\n").map(s => s.trim()).filter(Boolean),
        credentials: credentials.split("\n").map(s => s.trim()).filter(Boolean),
        specialization_type: specializationType,
        mentor_type: mentorType,
        exams: selectedExams,
        evaluation_source: evaluationSource,
        question_pdfs: questionPdfs
      };

      await authenticatedPut("/api/v1/mentorship/profile", token, payload);
      alert("Public profile updated successfully!");
      void fetchMyProfile();
    } catch (err: any) {
      alert("Failed to update profile: " + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingSettings(true);
    try {
      const payload = {
        display_name: displayName.trim(),
        is_public: isPublic,
        is_active: isActive
      };

      await authenticatedPut("/api/v1/mentorship/profile", token, payload);
      alert("Workspace settings updated successfully!");
      void fetchMyProfile();
    } catch (err: any) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleMockProfilePhoto = async () => {
    if (!token) return;
    try {
      const res = await authenticatedPost<any>("/api/v1/onboarding/assets/upload", token, {
        file_name: "profile_pic.jpg",
        asset_kind: "headshot",
      });
      setProfileImage(res.url);
      alert("Mock profile photo uploaded successfully!");
    } catch (err) {
      alert("Photo upload failed");
    }
  };

  const [slotType, setSlotType] = useState<"single" | "bulk">("single");

  // Bulk slot states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6]); // 1=Mon, ..., 6=Sat, 0=Sun
  const [timeRanges, setTimeRanges] = useState<Array<{ start: string; end: string }>>([
    { start: "09:00", end: "12:00" },
    { start: "16:00", end: "19:00" }
  ]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [newExclusionDate, setNewExclusionDate] = useState("");

  const handleAddTimeRange = () => {
    setTimeRanges(prev => [...prev, { start: "09:00", end: "17:00" }]);
  };
  const handleRemoveTimeRange = (idx: number) => {
    setTimeRanges(prev => prev.filter((_, i) => i !== idx));
  };
  const handleTimeRangeChange = (idx: number, field: "start" | "end", val: string) => {
    setTimeRanges(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const handleAddExclusion = () => {
    if (newExclusionDate && !exclusions.includes(newExclusionDate)) {
      setExclusions(prev => [...prev, newExclusionDate].sort());
      setNewExclusionDate("");
    }
  };
  const handleRemoveExclusion = (dateStr: string) => {
    setExclusions(prev => prev.filter(d => d !== dateStr));
  };

  const handleBulkGenerateSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !startDate || !endDate) return;

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    if (start > end) {
      alert("Start Date must be before or equal to End Date");
      return;
    }

    const slotsToCreate: any[] = [];
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      
      // Check if this day is selected in the weekly schedule
      if (selectedDays.includes(dayOfWeek)) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, "0");
        const dd = String(current.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;
        
        // Check if this date is excluded as a holiday
        if (!exclusions.includes(dateStr)) {
          // Generate slots for each time range
          for (const range of timeRanges) {
            if (range.start && range.end) {
              const startsAt = new Date(`${dateStr}T${range.start}:00`);
              const endsAt = new Date(`${dateStr}T${range.end}:00`);
              
              if (startsAt < endsAt) {
                slotsToCreate.push({
                  starts_at: startsAt.toISOString(),
                  ends_at: endsAt.toISOString(),
                  mode: "video",
                  max_bookings: 1,
                  title: "1-on-1 UPSC Mentorship",
                  description: "Video consultation with verified UPSC mentor",
                });
              }
            }
          }
        }
      }
      
      // Advance to next day
      current.setDate(current.getDate() + 1);
    }

    if (slotsToCreate.length === 0) {
      alert("No slots were generated. Check your date range and day selections.");
      return;
    }

    if (!confirm(`This will generate ${slotsToCreate.length} mentorship slots across this date range. Proceed?`)) {
      return;
    }

    setCreatingSlot(true);
    try {
      await authenticatedPost("/api/v1/mentorship/slots", token, {
        slots: slotsToCreate
      });
      alert(`Successfully generated and saved ${slotsToCreate.length} time slots!`);
      setStartDate("");
      setEndDate("");
      setExclusions([]);
      void fetchMySlots();
    } catch (err: any) {
      alert("Failed to generate slots: " + err.message);
    } finally {
      setCreatingSlot(false);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "mentor" && !["admin", "moderator"].includes(user.role)) {
        router.push("/become-mentor");
      }
    }
  }, [isInitialized, user, router]);

  const fetchRequests = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await authenticatedGet<MentorshipRequest[]>("/api/v1/mentorship/requests?mode=provider", token);
      setRequests(data || []);
      
      // Auto-select request
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

  const fetchMySlots = async () => {
    if (!token || !user) return;
    try {
      const data = await authenticatedGet<AvailabilitySlot[]>(
        `/api/v1/mentorship/slots?mentor_id=${user.id}`,
        token
      );
      setMySlots(data || []);
    } catch (err) {
      console.error(err);
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
      console.error(err);
    }
  };

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const data = await authenticatedGet<any[]>("/api/v1/notifications", token);
      if (data) {
        // Find any *new* unread notifications to trigger toasts
        const newUnread = data.filter(
          (notif) => !notif.is_read && !notifications.some((prev) => prev.id === notif.id)
        );
        
        if (newUnread.length > 0) {
          // Trigger a toast for each new unread notification
          newUnread.forEach((notif) => {
            const toastId = Date.now() + Math.random();
            setToasts((prev) => [...prev, { ...notif, id: toastId }]);
            // Auto dismiss toast after 5 seconds
            setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== toastId));
            }, 5000);
          });
        }
        
        setNotifications(data);
        setUnreadCount(data.filter((notif) => !notif.is_read).length);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    try {
      await authenticatedPut("/api/v1/notifications/mark-all-read", token, {});
      void fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    if (!token) return;
    try {
      await authenticatedPut(`/api/v1/notifications/${notif.id}/read`, token, {});
      void fetchNotifications();
      setShowNotificationsPopover(false);
      
      // Redirect or switch tabs based on link
      if (notif.link) {
        if (notif.link.includes("tab=requests")) {
          setActiveTab("requests");
        } else if (notif.link.includes("tab=calendar")) {
          setActiveTab("calendar");
        } else if (notif.link.startsWith("/")) {
          router.push(notif.link);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissToast = (toastId: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  const fetchSettings = async () => {
    if (!token) return;
    try {
      const data = await authenticatedGet<any>("/api/v1/mentorship/settings", token);
      if (data && data.target_exams) {
        setDynamicExams(data.target_exams);
      }
    } catch (err) {
      console.error("Error loading mentorship settings:", err);
    }
  };

  useEffect(() => {
    if (token) {
      void fetchRequests();
      void fetchMySlots();
      void fetchMyProfile();
      void fetchNotifications();
      void fetchSettings();

      // Poll notifications every 10 seconds
      const interval = setInterval(() => {
        void fetchNotifications();
      }, 10000);

      return () => clearInterval(interval);
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

  const handleCreateAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedRequest || !newAgendaTitle.trim()) return;
    setProposingAgenda(true);
    try {
      let attachedQuestion: any = null;
      if (selectedAgendaQuestionIndex !== "") {
        const idx = Number(selectedAgendaQuestionIndex);
        const q = questionPdfs[idx];
        if (q) {
          attachedQuestion = { file_name: q.file_name, url: q.url };
        }
      }
      await authenticatedPost(`/api/v1/mentorship/requests/${selectedRequest.id}/agendas`, token, {
        title: newAgendaTitle.trim(),
        description: newAgendaDesc.trim() || undefined,
        attached_question: attachedQuestion
      });
      setNewAgendaTitle("");
      setNewAgendaDesc("");
      setSelectedAgendaQuestionIndex("");
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

  const handleProposeSolveAgenda = async (agendaId: number) => {
    if (!token || !selectedRequest) return;
    try {
      await authenticatedPut(`/api/v1/mentorship/agendas/${agendaId}/solve-propose`, token, {});
      void fetchAgendas(selectedRequest.id);
    } catch (err: any) {
      alert("Failed to propose solve: " + err.message);
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

  useEffect(() => {
    if (selectedRequest) {
      void fetchMessages(selectedRequest.id);
      void fetchAgendas(selectedRequest.id);
      
      // Reset evaluation fields for selected copy -- sourced from the linked Mains
      // attempt when present, or from meta.evaluation for a directly-uploaded custom copy.
      const customEval = selectedRequest.meta?.evaluation;
      const evalSource = selectedRequest.mains_answer_attempt_id
        ? {
            score: selectedRequest.evaluation_score,
            max_score: selectedRequest.evaluation_max_score,
            feedback: selectedRequest.evaluation_feedback,
            checked_copy_url: selectedRequest.evaluation_checked_copy_url,
            checked_copy_file_name: undefined,
            strengths: selectedRequest.evaluation_strengths,
            weaknesses: selectedRequest.evaluation_weaknesses,
          }
        : customEval || {};

      setCheckedCopyUrl(evalSource.checked_copy_url || "");
      setCheckedCopyFileName(evalSource.checked_copy_file_name || "");
      setFeedback(evalSource.feedback || "");
      setScore(evalSource.score !== null && evalSource.score !== undefined ? String(evalSource.score) : "7");
      setMaxScore(evalSource.max_score !== null && evalSource.max_score !== undefined ? String(evalSource.max_score) : "10");
      setStrengthsRaw(evalSource.strengths?.join(", ") || "Strong arguments, logical layout");
      setWeaknessesRaw(evalSource.weaknesses?.join(", ") || "Grammar adjustments needed, expand intro");

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

  const handleTriageStatus = async (status: "accepted" | "rejected" | "completed") => {
    if (!token || !selectedRequest) return;
    try {
      await authenticatedPut(`/api/v1/mentorship/requests/${selectedRequest.id}/status`, token, { status });
      alert(`Request marked as ${status}!`);
      void fetchRequests();
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  // Add Availability Slot
  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !slotDate || !slotStartTime || !slotEndTime) return;

    setCreatingSlot(true);
    try {
      const startsAt = new Date(`${slotDate}T${slotStartTime}:00`).toISOString();
      const endsAt = new Date(`${slotDate}T${slotEndTime}:00`).toISOString();

      await authenticatedPost("/api/v1/mentorship/slots", token, {
        slots: [
          {
            starts_at: startsAt,
            ends_at: endsAt,
            mode: "video",
            max_bookings: 1,
            title: "1-on-1 UPSC Mentorship",
            description: "Video consultation with verified UPSC mentor",
          },
        ],
      });

      alert("Slot created successfully!");
      setSlotDate("");
      setSlotStartTime("");
      setSlotEndTime("");
      void fetchMySlots();
    } catch (err: any) {
      alert("Failed to create slot: " + err.message);
    } finally {
      setCreatingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (!token) return;
    if (!confirm("Are you sure you want to deactivate this slot?")) return;
    try {
      await authenticatedDelete(`/api/v1/mentorship/slots/${slotId}`, token);
      alert("Slot deactivated successfully!");
      void fetchMySlots();
    } catch (err: any) {
      alert("Deactivation failed: " + err.message);
    }
  };

  // Offer slots to this request
  const handleOfferSlots = async () => {
    if (!token || !selectedRequest || selectedOffers.length === 0) return;
    try {
      await authenticatedPost(`/api/v1/mentorship/requests/${selectedRequest.id}/offer-slots`, token, {
        slot_ids: selectedOffers,
      });
      alert("Availability slots offered to student!");
      setSelectedOffers([]);
      void fetchRequests();
    } catch (err: any) {
      alert("Offering slots failed: " + err.message);
    }
  };

  const toggleOfferSelect = (slotId: number) => {
    setSelectedOffers((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  // Upload the mentor's own checked/annotated copy of the student's answer
  const handleUploadCheckedCopy = async (file: File) => {
    if (!token) return;
    setUploadingCopy(true);
    try {
      const res = await authenticatedPost<any>("/api/v1/onboarding/assets/upload", token, {
        file_name: file.name,
        asset_kind: "checked_copy",
      });
      setCheckedCopyUrl(res.url);
      setCheckedCopyFileName(file.name);
    } catch (err) {
      alert("Failed to upload checked copy.");
    } finally {
      setUploadingCopy(false);
    }
  };

  // Submit copy evaluation feedback -- routed to the platform Mains evaluation
  // endpoint when a mains_answer_attempt is linked, or to the mentorship module's
  // own custom-copy evaluation endpoint otherwise.
  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedRequest) return;
    if (!selectedRequest.mains_answer_attempt_id && !selectedRequest.meta?.student_copy) return;

    setSubmittingEvaluation(true);
    try {
      const payload = {
        score: Number(score),
        max_score: Number(maxScore),
        feedback: feedback.trim() || undefined,
        checked_copy_url: checkedCopyUrl || undefined,
        checked_copy_file_name: checkedCopyFileName || undefined,
        strengths: strengthsRaw.split(",").map((s) => s.trim()).filter(Boolean),
        weaknesses: weaknessesRaw.split(",").map((w) => w.trim()).filter(Boolean),
      };

      if (selectedRequest.mains_answer_attempt_id) {
        await authenticatedPatch(
          `/api/v1/assessment/mains/answers/${selectedRequest.mains_answer_attempt_id}/evaluation`,
          token,
          payload
        );
      } else {
        await authenticatedPut(
          `/api/v1/mentorship/requests/${selectedRequest.id}/custom-copy-evaluation`,
          token,
          payload
        );
      }

      alert("Copy evaluation saved successfully!");
      void fetchRequests();
    } catch (err: any) {
      alert("Failed to submit copy evaluation: " + err.message);
    } finally {
      setSubmittingEvaluation(false);
    }
  };

  // Start call now
  const handleStartCallNow = async () => {
    if (!token || !selectedRequest) return;
    try {
      const session = await authenticatedPost<any>(
        `/api/v1/mentorship/requests/${selectedRequest.id}/start-now`,
        token,
        {}
      );
      router.push(`/mentorship/session/${session.id}`);
    } catch (err: any) {
      alert("Failed to start session: " + err.message);
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading mentor workspace...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left Sidebar Navigation */}
      <aside className="w-72 bg-surface border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 animate-in slide-in-from-left duration-200">
        <div className="p-6">
          {/* Brand header */}
          <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black">
              M
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 leading-none">Mentor Desk</h2>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none mt-1 inline-block">
                Coaching App
              </span>
            </div>
          </div>

          {/* Profile snapshot */}
          <div className="rounded-2xl border border-slate-100 p-4 bg-slate-50/50 mb-6 flex items-center gap-3">
            {profileImage ? (
              <img
                src={profileImage}
                alt={displayName}
                className="h-10 w-10 rounded-xl object-cover border border-slate-200"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 font-extrabold text-sm flex items-center justify-center shrink-0">
                {displayName ? displayName.charAt(0) : "M"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black text-slate-800 truncate leading-snug">
                {displayName || "Mentor User"}
              </h4>
              <span className="inline-flex items-center text-xs font-extrabold text-emerald-600 uppercase tracking-wider mt-0.5">
                Verified Mentor
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {[
              { id: "overview", label: "Dashboard Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
              { id: "requests", label: "Student Requests", icon: <ClipboardList className="h-4 w-4" />, badge: requests.length },
              { id: "calendar", label: "Availability Desk", icon: <Calendar className="h-4 w-4" />, badge: mySlots.length },
              { id: "profile", label: "Edit Public Profile", icon: <User className="h-4 w-4" /> },
              { id: "settings", label: "Workspace Settings", icon: <Settings className="h-4 w-4" /> }
            ].map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-955 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-black tracking-wider ${
                      active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-6 border-t border-slate-100 space-y-4">
          <Link
            href="/mentors"
            target="_blank"
            className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:underline"
          >
            <Globe className="h-3.5 w-3.5" />
            View Public Directory
          </Link>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span className="truncate max-w-[150px] font-medium" title={user?.email}>
              {user?.email}
            </span>
            <button
              onClick={logout}
              className="text-slate-400 hover:text-rose-600 p-1 font-bold"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Right Content Area */}
      <main className="flex-1 overflow-y-auto p-10 min-w-0 relative">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-800 capitalize tracking-tight">
              {activeTab === "overview" ? "Dashboard Overview" : activeTab === "requests" ? "Student Requests Inbox" : activeTab === "calendar" ? "Availability Desk" : activeTab === "profile" ? "Edit Public Profile" : "Workspace Settings"}
            </h1>
            <p className="text-sm text-slate-550 mt-1">
              {activeTab === "overview" && "Check your stats, quick tasks, and operations status."}
              {activeTab === "requests" && "Manage applicant requests, grade mains answers, and chat."}
              {activeTab === "calendar" && "Configure single and bulk availability slot ranges."}
              {activeTab === "profile" && "Edit details displayed in the public mentor directory."}
              {activeTab === "settings" && "Configure directory visibility and availability toggles."}
            </p>
          </div>
          
          {/* Notifications Center */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationsPopover(!showNotificationsPopover)}
              className="relative p-2.5 rounded-xl border border-slate-200 bg-surface hover:bg-slate-50 text-slate-650 hover:text-slate-850 transition shadow-sm"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
            
            {showNotificationsPopover && (
              <div className="absolute right-0 mt-3 w-96 rounded-3xl border border-slate-200 bg-surface p-5 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <h3 className="text-sm font-black text-slate-850">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-bold text-indigo-650 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8 italic">No notifications yet.</p>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all flex gap-3 ${
                          notif.is_read
                            ? "border-slate-100 bg-slate-50/50 hover:bg-slate-50"
                            : "border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50/30"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {notif.type === "chat_message" && <MessageSquare className="h-4 w-4 text-indigo-600" />}
                          {notif.type === "new_request" && <ClipboardList className="h-4 w-4 text-amber-600" />}
                          {notif.type === "session_booked" && <Calendar className="h-4 w-4 text-emerald-600" />}
                          {notif.type === "request_updated" && <CheckCircle2 className="h-4 w-4 text-indigo-650" />}
                          {notif.type === "slots_offered" && <Calendar className="h-4 w-4 text-indigo-650" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-850 truncate">{notif.title}</h4>
                          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{notif.message}</p>
                          <span className="text-[10px] text-slate-400 font-bold mt-1.5 inline-block">
                            {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Toast Overlay */}
        <div className="fixed bottom-6 right-6 z-50 space-y-3 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="w-96 pointer-events-auto rounded-2xl border border-indigo-100 bg-surface p-4 shadow-2xl flex gap-3 animate-in slide-in-from-bottom-5 duration-300"
            >
              <div className="mt-1 shrink-0 p-1.5 rounded-lg bg-indigo-50 text-indigo-650">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900">{toast.title}</h4>
                  <button
                    onClick={() => handleDismissToast(toast.id)}
                    className="text-slate-405 hover:text-slate-605 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-slate-550 mt-1 leading-snug">{toast.message}</p>
                <button
                  onClick={() => {
                    handleNotificationClick(toast);
                    handleDismissToast(toast.id);
                  }}
                  className="mt-2 text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                >
                  View Details <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Welcome Banner */}
            <div className="rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-8 text-white relative overflow-hidden shadow-xl">
              <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-indigo-500/10 blur-[80px] -mr-20 -mt-20" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-300">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                Coaching Operations Active
              </span>
              <h1 className="text-3xl md:text-4xl font-black mt-4 tracking-tight">
                Welcome back, <span className="bg-gradient-to-r from-indigo-300 to-sky-200 bg-clip-text text-transparent">{displayName || "Mentor"}</span>!
              </h1>
              <p className="text-slate-300 text-sm mt-3 max-w-xl leading-relaxed">
                Manage your UPSC candidates' copy evaluations, conduct private Agora video call triage sessions, and configure your slot schedule calendar details.
              </p>
            </div>

            {/* Metrics Cards Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Pending Requests", value: requests.filter((r) => r.status === "requested").length },
                { label: "Active Bookings", value: requests.filter((r) => r.status === "accepted").length },
                { label: "Defined Slots", value: mySlots.length },
                { label: "Experience Years", value: `${yearsExp} Years` }
              ].map((card, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 p-5 bg-surface shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">{card.label}</span>
                  <span className="text-2xl font-black text-slate-800 mt-2">{card.value}</span>
                </div>
              ))}
            </div>

            {/* Quick Tasks Card */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-[32px] border border-slate-200 bg-surface p-6 shadow-sm space-y-4 hover:border-indigo-100 transition">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-indigo-600" />
                  Pending Student Reviews
                </h3>
                <p className="text-sm text-slate-550">
                  You have {requests.filter((r) => r.status === "requested").length} new student requests waiting for review and evaluation.
                </p>
                <button
                  onClick={() => setActiveTab("requests")}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:underline"
                >
                  Go to Student Requests <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-surface p-6 shadow-sm space-y-4 hover:border-indigo-100 transition">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  Calendar Desk
                </h3>
                <p className="text-sm text-slate-550">
                  Configure availability ranges, select weekdays, exclude public holidays/festivals, and generate bulk slots.
                </p>
                <button
                  onClick={() => setActiveTab("calendar")}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:underline"
                >
                  Open Calendar Scheduler <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "requests" && (
          <div className="grid gap-8 lg:grid-cols-[360px_1fr] animate-in fade-in duration-200">
            {/* Incoming Requests List */}
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                Applicant Requests ({requests.length})
              </h2>
              <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
                {requests.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-surface p-8 text-center text-xs text-slate-400">
                    No active student requests.
                  </div>
                ) : (
                  requests.map((req) => (
                    <button
                      key={req.id}
                      onClick={() => setSelectedRequest(req)}
                      className={`w-full text-left rounded-3xl p-5 border transition-all ${
                        selectedRequest?.id === req.id
                          ? "border-indigo-600 bg-indigo-50/40 shadow-sm"
                          : "border-slate-200 bg-surface hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm leading-snug">
                            {req.learner_name || `Student #${req.user_id}`}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{req.learner_email || "No email"}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          req.status === "accepted" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-3">
                        <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                          {req.preferred_mode === "video" ? "Video call" : "Chat Triaging"}
                        </span>
                        {req.mains_answer_attempt_id && (
                          <span className="flex items-center gap-1 font-semibold text-emerald-600">
                            <Sparkles className="h-3 w-3" />
                            Subjective Copy
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Request Detail / Discussion Panel */}
            {selectedRequest ? (
              <div className="space-y-6">
                {/* Lifecycle tracker */}
                <div className="rounded-[32px] border border-slate-200 bg-surface p-5 shadow-sm">
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

                {/* Profile Card Header */}
                <div className="rounded-[32px] border border-slate-200 bg-surface p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Request from Student</span>
                      <h2 className="text-xl font-black text-slate-900">{selectedRequest.learner_name || `Student #${selectedRequest.user_id}`}</h2>
                      <p className="text-xs text-slate-500">Email: {selectedRequest.learner_email || "No email"}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {selectedRequest.status === "requested" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleTriageStatus("accepted")}
                            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleTriageStatus("rejected")}
                            className="rounded-xl border border-slate-200 bg-surface px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {selectedRequest.status === "accepted" && (
                        <div className="flex items-center gap-2">
                          {selectedRequest.payment_status === "paid" && (
                            <span className="rounded-xl bg-emerald-100 text-emerald-800 px-3 py-1.5 text-xs font-black uppercase tracking-wider">
                              Paid - Bookable
                            </span>
                          )}
                          <button
                            onClick={handleStartCallNow}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-600 flex items-center gap-1.5"
                          >
                            <Video className="h-4 w-4" />
                            Start Instant Room
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedRequest.note && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Student Message Context</p>
                      <p className="mt-2 text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl">
                        {selectedRequest.note}
                      </p>
                    </div>
                  )}

                  {/* Offer slots widget */}
                  {selectedRequest.status === "accepted" && selectedRequest.payment_status === "paid" && !selectedRequest.scheduled_slot_id && (
                    <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                      <h4 className="text-xs font-bold text-slate-800">Offer Specific Scheduling Slots</h4>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Select which of your calendar slots to offer this student. They can book one.
                      </p>
                      
                      <div className="flex flex-wrap gap-2">
                        {mySlots.map((slot) => {
                          const selected = selectedOffers.includes(slot.id);
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => toggleOfferSelect(slot.id)}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                selected
                                  ? "bg-indigo-600 text-white shadow-sm"
                                  : "border border-slate-200 bg-surface text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              {new Date(slot.starts_at).toLocaleDateString()} ({new Date(slot.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                            </button>
                          );
                        })}
                        {mySlots.length === 0 && (
                          <p className="text-xs text-rose-500 italic">Create availability slots in the Availability Desk tab first to offer them.</p>
                        )}
                      </div>
                      {selectedOffers.length > 0 && (
                        <button
                          onClick={handleOfferSlots}
                          className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600"
                        >
                          Send Offers ({selectedOffers.length})
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Grader / Evaluation Form -- covers both a linked platform Mains attempt
                    and a directly-uploaded custom copy (meta.student_copy) */}
                {(selectedRequest.mains_answer_attempt_id || selectedRequest.meta?.student_copy) && (
                  <div className="rounded-[32px] border border-slate-200 bg-surface p-6 shadow-sm space-y-6">
                    <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                        <FileText className="h-5 w-5 text-indigo-600" />
                        Subjective copy evaluation grader
                      </h3>
                      {selectedRequest.mains_answer_attempt_id ? (
                        <span className="text-xs font-bold text-slate-400">Attempt ID: #{selectedRequest.mains_answer_attempt_id}</span>
                      ) : (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase">
                          External Copy
                        </span>
                      )}
                    </div>

                    {/* Student Answer preview */}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                      {selectedRequest.mains_answer_attempt_id ? (
                        <>
                          <h4 className="text-[10px] font-black uppercase text-slate-400">Attempted Question</h4>
                          <p className="text-xs font-bold text-slate-800 leading-snug">{selectedRequest.attempt_question_statement || "No question loaded."}</p>

                          {selectedRequest.attempt_answer_file_url ? (
                            <a
                              href={selectedRequest.attempt_answer_file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-surface border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                            >
                              <FileText className="h-4 w-4 text-indigo-600" />
                              View Student PDF Submission
                            </a>
                          ) : (
                            <div className="text-xs text-slate-600 bg-surface p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                              {selectedRequest.attempt_student_answer_text || "No response details."}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <h4 className="text-[10px] font-black uppercase text-slate-400">Attached Answer Copy</h4>
                          <p className="text-xs font-bold text-slate-800 leading-snug">{selectedRequest.meta?.student_copy?.file_name}</p>
                          <a
                            href={selectedRequest.meta?.student_copy?.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-surface border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                          >
                            <FileText className="h-4 w-4 text-indigo-600" />
                            View Student PDF Submission
                          </a>
                        </>
                      )}
                    </div>

                    <form onSubmit={handleSubmitEvaluation} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Score</label>
                          <input
                            type="number"
                            required
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Max Score</label>
                          <input
                            type="number"
                            required
                            value={maxScore}
                            onChange={(e) => setMaxScore(e.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Feedback Summary</label>
                        <textarea
                          rows={3}
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Provide structural and analytical feedback..."
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500 resize-none"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Strengths (Comma separated)</label>
                          <input
                            type="text"
                            value={strengthsRaw}
                            onChange={(e) => setStrengthsRaw(e.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Weaknesses (Comma separated)</label>
                          <input
                            type="text"
                            value={weaknessesRaw}
                            onChange={(e) => setWeaknessesRaw(e.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Evaluated Copy Upload */}
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="text-xs font-bold text-slate-800">Checked Evaluated Copy</h4>
                          <p className="text-[10px] text-slate-400 truncate">
                            {checkedCopyFileName || "PDF showing red markings and margins feedback."}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {checkedCopyUrl && (
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">Uploaded</span>
                          )}
                          <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                            <Upload className="h-3.5 w-3.5" />
                            {uploadingCopy ? "Uploading..." : checkedCopyUrl ? "Replace PDF" : "Upload Checked PDF"}
                            <input
                              type="file"
                              accept="application/pdf,image/*"
                              disabled={uploadingCopy}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void handleUploadCheckedCopy(file);
                                e.target.value = "";
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submittingEvaluation}
                        className="rounded-xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/10 disabled:opacity-50"
                      >
                        {submittingEvaluation ? "Saving..." : "Save Copy Evaluation"}
                      </button>
                    </form>
                  </div>
                )}

                {/* Agendas Checklist Panel */}
                <AgendaPanel
                  agendas={agendas}
                  currentUserId={user?.id}
                  viewerRole="mentor"
                  paymentStatus={selectedRequest.payment_status}
                  isClosed={["completed", "rejected", "cancelled", "expired"].includes(selectedRequest.status)}
                  icon={<ClipboardList className="h-5 w-5 text-indigo-600" />}
                  proposing={proposingAgenda}
                  newTitle={newAgendaTitle}
                  newDesc={newAgendaDesc}
                  onTitleChange={setNewAgendaTitle}
                  onDescChange={setNewAgendaDesc}
                  onSubmitPropose={handleCreateAgenda}
                  onAgree={handleAgreeAgenda}
                  onProposeSolve={handleProposeSolveAgenda}
                  onDelete={handleDeleteAgenda}
                  titlePlaceholder="e.g. Mentor will evaluate 3 Mains papers..."
                  emptyStateText="No agendas have been proposed yet."
                  extraFormContent={
                    evaluationSource === "own_questions" && questionPdfs.length > 0 ? (
                      <div className="space-y-1 mt-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Attach one of your question PDFs (Optional)</label>
                        <select
                          value={selectedAgendaQuestionIndex}
                          onChange={(e) => setSelectedAgendaQuestionIndex(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-surface px-2 py-1.5 text-xs outline-none cursor-pointer"
                        >
                          <option value="">-- Select Question PDF --</option>
                          {questionPdfs.map((q, qidx) => (
                            <option key={qidx} value={qidx}>{q.file_name}</option>
                          ))}
                        </select>
                      </div>
                    ) : undefined
                  }
                  footerContent={
                    selectedRequest.status === "accepted" && selectedRequest.payment_status === "paid" ? (
                      <div className="border-t border-slate-100 pt-4 space-y-2">
                        {agendas.some((a) => a.status !== "solved") ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              disabled
                              className="w-full rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-400 border border-slate-200 cursor-not-allowed"
                            >
                              Complete Mentorship
                            </button>
                            <p className="text-[10px] text-rose-500 flex items-center gap-1 leading-normal">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              Cannot complete request yet. All proposed agendas must be solved with student consent confirmation.
                            </p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTriageStatus("completed")}
                            className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-md shadow-indigo-600/10"
                          >
                            Complete Mentorship
                          </button>
                        )}
                      </div>
                    ) : undefined
                  }
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
                        emptyStateText="No messages yet. Send a message to coordinate with the student."
                        inputPlaceholder="Type a message to coordinate with the student..."
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
                    subtitle="Discuss the scope of mentorship, clarify preparation focus, and align on deliverables with the student before payment."
                    badgeLabel="Coordination"
                    emptyStateText="Start Coordinating! Discuss goals, scope and propose deliverables with the student here."
                    inputPlaceholder="Type a message to coordinate with the student..."
                    height="400px"
                  />
                )}
              </div>
            ) : (
              <div className="flex h-[400px] flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-200 bg-surface p-8 text-center text-slate-400">
                <Calendar className="h-12 w-12 text-slate-300 mb-3 animate-pulse" />
                <p className="text-sm font-medium">Select a student request from the list to begin triaging.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="grid gap-8 lg:grid-cols-[380px_1fr] animate-in fade-in duration-200">
            {/* Create Availability Slots Form */}
            <div className="rounded-[32px] border border-slate-200 bg-surface p-6 shadow-sm space-y-4 h-fit">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <Plus className="h-4.5 w-4.5 text-indigo-600" />
                  Availability Desk
                </h3>
                
                <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSlotType("single")}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-all ${
                      slotType === "single"
                        ? "bg-surface text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotType("bulk")}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-all ${
                      slotType === "bulk"
                        ? "bg-surface text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Bulk
                  </button>
                </div>
              </div>
              
              {slotType === "single" ? (
                <form onSubmit={handleCreateSlot} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Date</label>
                    <input
                      type="date"
                      required
                      value={slotDate}
                      onChange={(e) => setSlotDate(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Start Time</label>
                      <input
                        type="time"
                        required
                        value={slotStartTime}
                        onChange={(e) => setSlotStartTime(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">End Time</label>
                      <input
                        type="time"
                        required
                        value={slotEndTime}
                        onChange={(e) => setSlotEndTime(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={creatingSlot}
                    className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-indigo-600 transition disabled:opacity-50"
                  >
                    {creatingSlot ? "Adding..." : "Add Time Slot"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleBulkGenerateSlots} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Start Date</label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-600">End Date</label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Weekly Schedule</label>
                    <div className="mt-2 flex gap-1 justify-between">
                      {[
                        { label: "M", value: 1 },
                        { label: "T", value: 2 },
                        { label: "W", value: 3 },
                        { label: "T", value: 4 },
                        { label: "F", value: 5 },
                        { label: "S", value: 6 },
                        { label: "S", value: 0 }
                      ].map((d) => {
                        const active = selectedDays.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => {
                              setSelectedDays(prev =>
                                prev.includes(d.value) ? prev.filter(v => v !== d.value) : [...prev, d.value]
                              );
                            }}
                            className={`h-7 w-7 rounded-full text-xs font-black transition ${
                              active
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "border border-slate-200 bg-surface text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Daily Time Slots</label>
                      <button
                        type="button"
                        onClick={handleAddTimeRange}
                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                      >
                        + Add Range
                      </button>
                    </div>
                    {timeRanges.map((range, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <input
                          type="time"
                          required
                          value={range.start}
                          onChange={(e) => handleTimeRangeChange(idx, "start", e.target.value)}
                          className="flex-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500"
                        />
                        <span className="text-slate-400 text-xs shrink-0">to</span>
                        <input
                          type="time"
                          required
                          value={range.end}
                          onChange={(e) => handleTimeRangeChange(idx, "end", e.target.value)}
                          className="flex-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500"
                        />
                        {timeRanges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTimeRange(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 font-bold shrink-0"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Festival/Holiday Exclusions</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={newExclusionDate}
                        onChange={(e) => setNewExclusionDate(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddExclusion}
                        className="rounded-xl bg-slate-900 px-3 text-xs font-bold text-white hover:bg-indigo-600 transition"
                      >
                        Exclude
                      </button>
                    </div>
                    {exclusions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pt-1">
                        {exclusions.map((dateStr) => (
                          <span
                            key={dateStr}
                            className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-100 px-2.5 py-0.5 text-[9px] font-bold text-rose-700"
                          >
                            {new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            <button
                              type="button"
                              onClick={() => handleRemoveExclusion(dateStr)}
                              className="hover:text-rose-950 font-bold shrink-0"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={creatingSlot}
                    className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-indigo-600 transition disabled:opacity-50"
                  >
                    {creatingSlot ? "Generating Slots..." : "Generate Bulk Slots"}
                  </button>
                </form>
              )}
            </div>

            {/* Slots List Panel */}
            <div className="rounded-[32px] border border-slate-200 bg-surface p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <Calendar className="h-4.5 w-4.5 text-indigo-600" />
                Defined Availability Slots ({mySlots.length})
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-h-[600px] overflow-y-auto pr-1">
                {mySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-xs hover:border-indigo-100 hover:bg-surface transition shadow-sm"
                  >
                    <div>
                      <p className="font-extrabold text-slate-800 text-sm">
                        {new Date(slot.starts_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">
                        {new Date(slot.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    
                    <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        slot.booked_count > 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                      }`}>
                        {slot.booked_count > 0 ? "Booked" : "Available"}
                      </span>
                      <button
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition"
                        title="Delete Slot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {mySlots.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400 italic text-xs border border-dashed border-slate-200 rounded-2xl bg-surface">
                    No slot configurations defined yet. Use the Availability Desk to add options.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="rounded-[32px] border border-slate-200 bg-surface p-8 shadow-sm max-w-3xl mx-auto animate-in fade-in duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-2">Edit Public Profile Details</h2>
            <p className="text-slate-500 text-xs mb-8">
              Update the educational, professional, and personal details shown to aspirants on the mentors search directory.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Profile Image Row */}
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 flex items-center gap-6">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile Headshot"
                    className="h-20 w-20 rounded-2xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 font-extrabold text-xs shrink-0">
                    No Photo
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Public Profile Picture</h3>
                  <p className="text-xs text-slate-500 mb-2.5">Upload a high-quality professional headshot.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleMockProfilePhoto}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Mock Upload Photo
                    </button>
                    {profileImage && (
                      <button
                        type="button"
                        onClick={() => setProfileImage("")}
                        className="rounded-xl border border-slate-200 bg-surface px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-slate-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin-Assigned Specifications */}
              {adminSpecs.length > 0 && (
                <div className="rounded-2xl border border-slate-100 p-4 bg-slate-50/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Admin-Assigned Mentorship Specifications</span>
                  <div className="flex flex-wrap gap-1.5">
                    {adminSpecs.map((spec) => (
                      <span key={spec} className="rounded-full bg-indigo-50 border border-indigo-100/50 text-indigo-700 px-3 py-1 text-xs font-bold">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mentor Type & Specialization Type */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">Mentorship Type</label>
                  <select
                    value={mentorType}
                    onChange={(e) => setMentorType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs bg-surface outline-none focus:border-indigo-500"
                  >
                    <option value="evaluation_mentorship">Evaluation + Mentorship</option>
                    <option value="only_mentorship">Only Mentorship</option>
                  </select>
                </div>

                {mentorType === "evaluation_mentorship" && (
                  <div className="grid gap-4 sm:grid-cols-2 mt-4 p-4 rounded-2xl bg-indigo-50/20 border border-indigo-100/30">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">Evaluation Copy Source</label>
                      <select
                        value={evaluationSource}
                        onChange={(e) => setEvaluationSource(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs bg-surface outline-none focus:border-indigo-500"
                      >
                        <option value="any_source">Evaluate copies from any source</option>
                        <option value="own_questions">Evaluate only on my own questions</option>
                      </select>
                    </div>

                    {evaluationSource === "own_questions" && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                          Your Question PDFs <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <div className="space-y-1.5">
                          {questionPdfs.map((pdf, pidx) => (
                            <div key={pidx} className="flex items-center justify-between bg-surface p-2 rounded-xl border border-slate-200 text-xs">
                              <span className="font-semibold text-slate-700 truncate max-w-[150px]">{pdf.file_name}</span>
                              <button
                                type="button"
                                onClick={() => setQuestionPdfs(questionPdfs.filter((_, idx) => idx !== pidx))}
                                className="text-xs text-rose-600 hover:underline font-bold"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                          <label className="flex items-center justify-center border border-dashed border-slate-300 rounded-xl p-2.5 bg-surface hover:bg-slate-50 cursor-pointer text-[10px] font-bold text-slate-500 transition">
                            {uploadingQuestion ? "Uploading..." : "+ Add Question PDF"}
                            <input
                              type="file"
                              accept="application/pdf"
                              disabled={uploadingQuestion}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingQuestion(true);
                                try {
                                  const res = await fetch(`${browserBaseUrl}/api/v1/onboarding/assets/upload`, {
                                    method: "POST",
                                    headers: {
                                      "content-type": "application/json",
                                      "authorization": `Bearer ${token}`
                                    },
                                    body: JSON.stringify({ file_name: file.name, asset_kind: "mentor_question" })
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    setQuestionPdfs([...questionPdfs, { file_name: file.name, url: data.url }]);
                                  } else {
                                    alert("Upload failed.");
                                  }
                                } catch (err) {
                                  console.error(err);
                                  alert("Error uploading file.");
                                } finally {
                                  setUploadingQuestion(false);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">Specialization Scope</label>
                  <select
                    value={specializationType}
                    onChange={(e) => setSpecializationType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs bg-surface outline-none focus:border-indigo-500"
                  >
                    <option value="all_areas">Expert in all areas</option>
                    <option value="specific_field">Expert in specific field</option>
                  </select>
                </div>
              </div>

              {/* Conditional Specialization Tags */}
              {specializationType === "specific_field" && (
                <div className="mt-4 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100/50">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-950 block mb-1.5">
                    Describe your Specialization(s) (Comma-separated) <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GS4 Ethics, Essay, Public Administration, Geography"
                    value={specializationTags}
                    onChange={(e) => setSpecializationTags(e.target.value)}
                    className="w-full rounded-xl border border-indigo-200 bg-surface px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-indigo-600/80 mt-1.5">Please list the specific subjects or topics you can mentor students in.</p>
                </div>
              )}

              {/* Target Exams Coverage */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">Target Exams Coverage</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {dynamicExams.map((exam) => {
                    const isChecked = selectedExams.includes(exam);
                    return (
                      <label
                        key={exam}
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
                              setSelectedExams([...selectedExams, exam]);
                            } else {
                              setSelectedExams(selectedExams.filter((x) => x !== exam));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                        />
                        {exam}
                      </label>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customExamText}
                    onChange={(e) => setCustomExamText(e.target.value)}
                    placeholder="Add custom exam (e.g. State PCS, SSC)..."
                    className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (customExamText.trim() && !selectedExams.includes(customExamText.trim())) {
                          setSelectedExams([...selectedExams, customExamText.trim()]);
                          setCustomExamText("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customExamText.trim() && !selectedExams.includes(customExamText.trim())) {
                        setSelectedExams([...selectedExams, customExamText.trim()]);
                        setCustomExamText("");
                      }
                    }}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shrink-0"
                  >
                    Add Exam
                  </button>
                </div>

                {selectedExams.filter(x => !dynamicExams.includes(x)).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedExams
                      .filter((x) => !dynamicExams.includes(x))
                      .map((exam) => (
                        <span
                          key={exam}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 border border-slate-200"
                        >
                          {exam}
                          <button
                            type="button"
                            onClick={() => setSelectedExams(selectedExams.filter((x) => x !== exam))}
                            className="text-slate-400 hover:text-slate-600 font-bold ml-0.5"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* Name & Headline */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Display Name</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Public Email</label>
                  <input
                    type="email"
                    value={publicEmail}
                    onChange={(e) => setPublicEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Headline */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Professional Headline</label>
                <input
                  type="text"
                  placeholder="e.g. IAS Officer (Retd), GS4 Ethics Specialist"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              {/* Experience & City */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Years of Mentorship Experience</label>
                  <input
                    type="number"
                    min={0}
                    value={yearsExp}
                    onChange={(e) => setYearsExp(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">City / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. New Delhi, India"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Biography */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Biography / Description</label>
                <textarea
                  rows={6}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Introduce yourself, your UPSC credentials, your mentorship methodology, Optional subject specialties, etc."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Education */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Education / Academic Background</label>
                <textarea
                  rows={3}
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="e.g. B.Tech from IIT Delhi, M.A. in Public Policy from JNU"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Education */}

              {/* Highlights */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Highlights / Achievements (One per line)</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Cleared Mains 3 times&#10;Interview Faced 2021&#10;Evaluated 500+ mains answer sheets"
                  value={highlights}
                  onChange={(e) => setHighlights(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Credentials */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Verified Credentials (One per line)</label>
                <textarea
                  rows={3}
                  placeholder="e.g. UPSC Credentials Verified&#10;Verified CSE 2023 Marksheet&#10;Sample Evaluation Approved"
                  value={credentials}
                  onChange={(e) => setCredentials(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full rounded-2xl bg-indigo-600 py-3.5 font-bold text-white transition hover:bg-indigo-700 shadow-lg shadow-indigo-600/10 disabled:opacity-60"
              >
                {savingProfile ? "Saving Profile..." : "Save Public Profile Settings"}
              </button>
            </form>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="rounded-[32px] border border-slate-200 bg-surface p-8 shadow-sm max-w-xl mx-auto animate-in fade-in duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-2">Workspace Settings</h2>
            <p className="text-slate-500 text-xs mb-8">
              Configure your visibility options and request acceptance preferences.
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Toggle 1: is_public */}
              <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-slate-500" />
                    Public Directory Visibility
                  </label>
                  <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                    When enabled, your profile card will be listed on the public directory page. If disabled, you are hidden from search lists.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-1 shrink-0"
                />
              </div>

              {/* Toggle 2: is_active */}
              <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-slate-500" />
                    Accepting New Requests
                  </label>
                  <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                    When enabled, students will see a button to request new consultations with you. Turn this off if you are fully booked.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-1 shrink-0"
                />
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full rounded-2xl bg-indigo-600 py-3.5 font-bold text-white transition hover:bg-indigo-700 shadow-lg shadow-indigo-600/10 disabled:opacity-60"
              >
                {savingSettings ? "Saving Settings..." : "Save Workspace Settings"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

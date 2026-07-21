import { z } from "zod";
import { listQuerySchema } from "../../common/http.js";

const idSchema = z.coerce.number().int().positive();

export const onboardingAssetSchema = z.object({
  bucket: z.string().trim().min(1),
  path: z.string().trim().min(1),
  file_name: z.string().trim().min(1),
  mime_type: z.string().trim().optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  uploaded_at: z.string().trim().optional(),
  url: z.string().url().optional()
});

export const onboardingDetailsSchema = z.object({
  current_occupation: z.string().trim().nullable().optional(),
  professional_headshot: onboardingAssetSchema.nullable().optional(),
  upsc_roll_number: z.string().trim().nullable().optional(),
  upsc_years: z.string().trim().nullable().optional(),
  proof_documents: z.array(onboardingAssetSchema).optional(),
  mains_written_count: z.number().int().nonnegative().nullable().optional(),
  interview_faced_count: z.number().int().nonnegative().nullable().optional(),
  optional_subject: z.string().trim().nullable().optional(),
  gs_preferences: z.array(z.string().trim()).optional(),
  mentorship_years: z.number().int().nonnegative().nullable().optional(),
  institute_associations: z.array(z.string().trim()).optional(),
  sample_evaluation: onboardingAssetSchema.nullable().optional(),
  intro_video_url: z.string().trim().nullable().optional()
});

export const createOnboardingApplicationSchema = z.object({
  desired_role: z.literal("mentor"),
  full_name: z.string().trim().min(2).max(120),
  city: z.string().trim().max(120).nullable().optional(),
  years_experience: z.number().int().nonnegative().max(60).nullable().optional(),
  phone: z.string().trim().min(7).max(40),
  about: z.string().trim().max(3000).nullable().optional(),
  details: onboardingDetailsSchema.default({})
});

export const draftOnboardingApplicationSchema = z.object({
  desired_role: z.literal("mentor"),
  full_name: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).nullable().optional(),
  years_experience: z.number().int().nonnegative().max(60).nullable().optional(),
  phone: z.string().trim().max(40).optional(),
  about: z.string().trim().max(3000).nullable().optional(),
  details: onboardingDetailsSchema.optional()
});

export const reviewOnboardingApplicationSchema = z.object({
  action: z.enum(["approve", "reject", "request_more_info"]),
  reviewer_note: z.string().trim().max(1200).nullable().optional(),
  specifications: z.array(z.string().trim()).optional()
});

export const listOnboardingApplicationsQuerySchema = listQuerySchema.extend({
  status: z.enum(["pending", "approved", "rejected", "more_info_required", "draft", "all"]).optional(),
  limit: z.coerce.number().int().positive().default(200)
});

export const createMentorshipSlotSchema = z.object({
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  mode: z.string().trim().default("video"),
  max_bookings: z.number().int().positive().default(1),
  meeting_link: z.string().trim().optional(),
  title: z.string().trim().optional(),
  description: z.string().trim().optional()
});

export const createMentorshipSlotsBatchSchema = z.object({
  slots: z.array(createMentorshipSlotSchema)
});

export const listMentorshipSlotsQuerySchema = listQuerySchema.extend({
  mentor_id: idSchema.optional(),
  upcoming_only: z.coerce.boolean().optional(),
  active_only: z.coerce.boolean().optional()
});

export const createMentorshipRequestSchema = z.object({
  mentor_id: idSchema,
  mains_answer_attempt_id: idSchema.nullable().optional(),
  preferred_mode: z.string().trim().default("video"),
  note: z.string().trim().max(3000).optional(),
  student_copy: z.object({
    url: z.string().url(),
    file_name: z.string()
  }).nullable().optional()
});

export const updateMentorshipRequestStatusSchema = z.object({
  status: z.enum(["accepted", "rejected", "completed"])
});

export const verifyMentorshipPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1)
});

export type VerifyMentorshipPaymentInput = z.output<typeof verifyMentorshipPaymentSchema>;

export const sendMentorshipMessageSchema = z.object({
  body: z.string().trim().min(1)
});

export const offerSlotsSchema = z.object({
  slot_ids: z.array(idSchema)
});

export const submitCustomCopyEvaluationSchema = z.object({
  score: z.number().nonnegative(),
  max_score: z.number().positive(),
  feedback: z.string().trim().max(4000).nullable().optional(),
  checked_copy_url: z.string().url().nullable().optional(),
  checked_copy_file_name: z.string().trim().max(255).nullable().optional(),
  strengths: z.array(z.string().trim()).optional(),
  weaknesses: z.array(z.string().trim()).optional()
});

export type SubmitCustomCopyEvaluationInput = z.output<typeof submitCustomCopyEvaluationSchema>;

export const createAgendaSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  attached_question: z.object({
    file_name: z.string(),
    url: z.string().url()
  }).nullable().optional()
});

export type CreateOnboardingApplicationInput = z.output<typeof createOnboardingApplicationSchema>;
export type DraftOnboardingApplicationInput = z.output<typeof draftOnboardingApplicationSchema>;
export type ReviewOnboardingApplicationInput = z.output<typeof reviewOnboardingApplicationSchema>;
export type ListOnboardingApplicationsQuery = z.output<typeof listOnboardingApplicationsQuerySchema>;
export type CreateMentorshipSlotInput = z.output<typeof createMentorshipSlotSchema>;
export type CreateMentorshipSlotsBatchInput = z.output<typeof createMentorshipSlotsBatchSchema>;
export type ListMentorshipSlotsQuery = z.output<typeof listMentorshipSlotsQuerySchema>;
export type CreateMentorshipRequestInput = z.output<typeof createMentorshipRequestSchema>;
export type UpdateMentorshipRequestStatusInput = z.output<typeof updateMentorshipRequestStatusSchema>;
export type SendMentorshipMessageInput = z.output<typeof sendMentorshipMessageSchema>;
export type OfferSlotsInput = z.output<typeof offerSlotsSchema>;
export type CreateAgendaInput = z.output<typeof createAgendaSchema>;

export const updateMentorProfileSchema = z.object({
  display_name: z.string().trim().min(2).max(120),
  headline: z.string().trim().max(255).nullable().optional(),
  bio: z.string().trim().max(3000).nullable().optional(),
  years_experience: z.number().int().nonnegative().max(60).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  profile_image_url: z.string().url().nullable().optional(),
  contact_url: z.string().url().nullable().optional(),
  public_email: z.string().email().nullable().optional(),
  education: z.string().trim().max(1000).nullable().optional(),
  is_public: z.boolean().optional(),
  is_active: z.boolean().optional(),
  specialization_tags: z.array(z.string().trim()).optional(),
  highlights: z.array(z.string().trim()).optional(),
  credentials: z.array(z.string().trim()).optional(),
  specifications: z.array(z.string().trim()).optional(),
  exams: z.array(z.string().trim()).optional(),
  specialization_type: z.enum(["all_areas", "specific_field"]).optional(),
  mentor_type: z.enum(["evaluation_mentorship", "only_mentorship"]).optional(),
  evaluation_source: z.enum(["any_source", "own_questions"]).optional(),
  question_pdfs: z.array(z.object({
    file_name: z.string().trim().min(1),
    url: z.string().url(),
    path: z.string().trim().optional()
  })).optional()
});

export type UpdateMentorProfileInput = z.output<typeof updateMentorProfileSchema>;

export const promoteMentorSchema = z.object({
  user_id: idSchema.optional(),
  email: z.string().trim().email().optional()
}).refine((data) => data.user_id !== undefined || data.email !== undefined, {
  message: "Provide either a user_id or an email."
});

export type PromoteMentorInput = z.output<typeof promoteMentorSchema>;

export const updateMentorshipSettingSchema = z.object({
  key: z.string().trim().min(1),
  value: z.array(z.string().trim())
});

export type UpdateMentorshipSettingInput = z.output<typeof updateMentorshipSettingSchema>;



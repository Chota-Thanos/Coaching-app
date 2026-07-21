import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse, withValidation } from "../../common/http.js";
import { requireAuth, requireAdminOrEditor, requireRole } from "../auth/guards.js";
import { one } from "../../db.js";
import {
  saveOnboardingDraft,
  submitOnboarding,
  listMyOnboardings,
  listAllOnboardings,
  reviewOnboarding,
  listMentorProfiles,
  getMentorProfile,
  createSlots,
  listSlots,
  deactivateSlot,
  createRequest,
  listRequests,
  listAllRequestsForAdmin,
  updateRequestStatus,
  submitCustomCopyEvaluation,
  offerSlots,
  createMentorshipPaymentOrder,
  verifyMentorshipPayment,
  acceptSlotAndBook,
  startSessionNow,
  sendMessage,
  listMessages,
  generateAgoraToken,
  updateMentorProfile,
  promoteUserToMentor,
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createAgenda,
  listAgendas,
  agreeToAgenda,
  proposeSolveAgenda,
  confirmSolveAgenda,
  deleteAgenda,
  getMentorshipSettings,
  updateMentorshipSetting
} from "./service.js";
import {
  createOnboardingApplicationSchema,
  draftOnboardingApplicationSchema,
  reviewOnboardingApplicationSchema,
  listOnboardingApplicationsQuerySchema,
  createMentorshipSlotsBatchSchema,
  listMentorshipSlotsQuerySchema,
  createMentorshipRequestSchema,
  updateMentorshipRequestStatusSchema,
  offerSlotsSchema,
  submitCustomCopyEvaluationSchema,
  sendMentorshipMessageSchema,
  updateMentorProfileSchema,
  createAgendaSchema,
  verifyMentorshipPaymentSchema,
  updateMentorshipSettingSchema,
  promoteMentorSchema
} from "./schemas.js";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

const sessionIdParamSchema = z.object({
  sessionId: z.coerce.number().int().positive()
});

export async function registerMentorshipRoutes(server: FastifyInstance): Promise<void> {
  // --- Onboarding Endpoints ---

  server.post("/api/v1/onboarding/applications/draft", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(draftOnboardingApplicationSchema, request.body);
      const record = await saveOnboardingDraft(user.id, body, user.email);
      return record;
    });
  });

  server.post("/api/v1/onboarding/applications", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(createOnboardingApplicationSchema, request.body);
      const record = await submitOnboarding(user.id, body, user.email);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/onboarding/applications/me", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      return listMyOnboardings(user.id);
    });
  });

  server.get("/api/v1/admin/onboarding/applications", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const query = parse(listOnboardingApplicationsQuerySchema, request.query);
      return listAllOnboardings(query.status || "all", query.limit);
    });
  });

  server.put("/api/v1/admin/onboarding/applications/:id/review", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(reviewOnboardingApplicationSchema, request.body);
      const record = await reviewOnboarding(params.id, user.id, body);
      return record;
    });
  });

  // Admin action: directly promote a user to mentor (bypassing the onboarding
  // application), seeding a starter mentor profile.
  server.post("/api/v1/admin/mentorship/promote", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(promoteMentorSchema, request.body);
      try {
        return await promoteUserToMentor({ user_id: body.user_id, email: body.email });
      } catch (err: any) {
        return reply.badRequest(err.message);
      }
    });
  });

  server.post("/api/v1/onboarding/assets/upload", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = (request.body || {}) as { file_name?: string; asset_kind?: string };
      const fileName = body.file_name || "proof.pdf";
      const assetKind = body.asset_kind || "proof_document";
      const mockPath = `onboarding/${user.id}_${Date.now()}_${fileName}`;
      return {
        bucket: "public_assets",
        path: mockPath,
        file_name: fileName,
        mime_type: "application/pdf",
        size_bytes: 1024 * 102,
        uploaded_at: new Date().toISOString(),
        asset_kind: assetKind,
        url: `https://raw.githubusercontent.com/creator-alpha001/new-upsc-git/main/docs/${fileName}`
      };
    });
  });

  // --- Mentor Profile Directory ---

  server.get("/api/v1/mentorship/profiles", async (request, reply) => {
    return withValidation(reply, async () => {
      return listMentorProfiles();
    });
  });

  server.get("/api/v1/mentorship/profiles/:id", async (request, reply) => {
    let currentUser: any = null;
    try {
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        currentUser = await requireAuth(request);
      }
    } catch {
      // ignore
    }

    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getMentorProfile(params.id);
      if (!record) return reply.notFound("Mentor profile not found.");

      // Check access to question_pdfs
      const meta = (record as any).meta || {};
      if (meta.question_pdfs && meta.question_pdfs.length > 0 && meta.evaluation_source === "own_questions") {
        let hasAccess = false;
        if (currentUser) {
          if (currentUser.id === Number(record.user_id) || ["admin", "moderator"].includes(currentUser.role)) {
            hasAccess = true;
          } else {
            const booking = await one(
              `select 1 from app.mentorship_requests 
               where user_id = $1 and mentor_id = $2 and (payment_status = 'paid' or status in ('accepted', 'completed')) 
               limit 1`,
              [currentUser.id, record.user_id]
            );
            if (booking) {
              hasAccess = true;
            }
          }
        }

        if (!hasAccess) {
          (record as any).meta = {
            ...meta,
            question_pdfs: meta.question_pdfs.map((q: any) => ({
              file_name: q.file_name,
              url: null,
              locked: true
            }))
          };
        }
      }

      return record;
    });
  });

  server.put("/api/v1/mentorship/profile", async (request, reply) => {
    const user = await requireRole(request, ["admin", "moderator", "mentor"]);
    return withValidation(reply, async () => {
      const body = parse(updateMentorProfileSchema, request.body);
      const record = await updateMentorProfile(user.id, body);
      return record;
    });
  });

  // --- Availability Slots ---

  server.post("/api/v1/mentorship/slots", async (request, reply) => {
    const user = await requireRole(request, ["admin", "moderator", "mentor"]);
    return withValidation(reply, async () => {
      const body = parse(createMentorshipSlotsBatchSchema, request.body);
      const records = await createSlots(user.id, body.slots);
      return reply.status(201).send(records);
    });
  });

  server.get("/api/v1/mentorship/slots", async (request, reply) => {
    await requireAuth(request);
    return withValidation(reply, async () => {
      const query = parse(listMentorshipSlotsQuerySchema, request.query);
      return listSlots(query);
    });
  });

  server.delete("/api/v1/mentorship/slots/:id", async (request, reply) => {
    const user = await requireRole(request, ["admin", "moderator", "mentor"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deactivateSlot(user.id, params.id);
      if (!record) return reply.notFound("Slot not found or not owned by you.");
      return record;
    });
  });

  // --- Requests & Booking Flow ---

  server.post("/api/v1/mentorship/requests", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(createMentorshipRequestSchema, request.body);
      try {
        const record = await createRequest(user.id, body);
        return reply.status(201).send(record);
      } catch (err: any) {
        return reply.badRequest(err.message);
      }
    });
  });

  server.get("/api/v1/mentorship/requests", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const queryParams = (request.query || {}) as { mode?: string };
      const mode = queryParams.mode === "provider" ? "provider" : "user";
      return listRequests(user.id, user.role, mode);
    });
  });

  // Admin oversight of every in-flight mentorship engagement (not scoped to one user/mentor)
  server.get("/api/v1/admin/mentorship/requests", async (request, reply) => {
    await requireRole(request, ["admin", "moderator"]);
    return withValidation(reply, async () => {
      const queryParams = (request.query || {}) as { status?: string; payment_status?: string; limit?: string };
      return listAllRequestsForAdmin({
        status: queryParams.status,
        payment_status: queryParams.payment_status,
        limit: queryParams.limit ? Number(queryParams.limit) : undefined
      });
    });
  });

  server.put("/api/v1/mentorship/requests/:id/status", async (request, reply) => {
    const user = await requireRole(request, ["admin", "moderator", "mentor"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateMentorshipRequestStatusSchema, request.body);
      try {
        const record = await updateRequestStatus(params.id, user.id, body.status);
        if (!record) return reply.notFound("Request not found or not owned by you.");
        return record;
      } catch (err: any) {
        return reply.badRequest(err.message);
      }
    });
  });

  server.post("/api/v1/mentorship/requests/:id/offer-slots", async (request, reply) => {
    const user = await requireRole(request, ["admin", "moderator", "mentor"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(offerSlotsSchema, request.body);
      const record = await offerSlots(params.id, user.id, body.slot_ids);
      if (!record) return reply.notFound("Request not found or not owned by you.");
      return record;
    });
  });

  server.post("/api/v1/mentorship/requests/:id/payment/order", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      try {
        const order = await createMentorshipPaymentOrder(params.id, user.id);
        return reply.status(201).send(order);
      } catch (err: any) {
        if (err.statusCode === 404) return reply.notFound(err.message);
        return reply.badRequest(err.message);
      }
    });
  });

  server.post("/api/v1/mentorship/requests/:id/payment/verify", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(verifyMentorshipPaymentSchema, request.body);
      try {
        const record = await verifyMentorshipPayment(params.id, user.id, body);
        return record;
      } catch (err: any) {
        if (err.statusCode === 404) return reply.notFound(err.message);
        return reply.badRequest(err.message);
      }
    });
  });

  server.post("/api/v1/mentorship/requests/:id/book-slot", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(z.object({ slot_id: z.coerce.number().int().positive() }), request.body);
      const record = await acceptSlotAndBook(params.id, user.id, body.slot_id);
      return record;
    });
  });

  server.post("/api/v1/mentorship/requests/:id/start-now", async (request, reply) => {
    const user = await requireRole(request, ["admin", "moderator", "mentor"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await startSessionNow(params.id, user.id);
      return record;
    });
  });

  // Evaluation for requests where the student attached a directly-uploaded copy
  // (not linked to a platform Mains attempt -- see /assessment/mains/answers/:id/evaluation for that path).
  server.put("/api/v1/mentorship/requests/:id/custom-copy-evaluation", async (request, reply) => {
    const user = await requireRole(request, ["admin", "moderator", "mentor"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(submitCustomCopyEvaluationSchema, request.body);
      try {
        const record = await submitCustomCopyEvaluation(params.id, user.id, user.role, body);
        return record;
      } catch (err: any) {
        return reply.badRequest(err.message);
      }
    });
  });

  // --- Agora Video Call Room ---

  server.get("/api/v1/mentorship/sessions/:sessionId/agora-token", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(sessionIdParamSchema, request.params);
      
      // Verify user is a participant of the session's parent request
      const session = await one<any>(
        `select user_id, mentor_id, starts_at, meeting_link from app.mentorship_sessions where id = $1`,
        [params.sessionId]
      );
      if (!session) return reply.notFound("Session not found.");
      if (session.user_id !== user.id && session.mentor_id !== user.id) {
        return reply.forbidden("You are not authorized to join this session.");
      }

      return {
        ...generateAgoraToken(`mentorship-session-${params.sessionId}`, user.id),
        meetingLink: session.meeting_link || null
      };
    });
  });

  // --- Chat Message Endpoints ---

  server.get("/api/v1/mentorship/requests/:id/messages", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      try {
        return await listMessages(params.id, user.id, user.role);
      } catch (err: any) {
        return reply.forbidden(err.message);
      }
    });
  });

  server.post("/api/v1/mentorship/requests/:id/messages", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(sendMentorshipMessageSchema, request.body);
      const record = await sendMessage(params.id, user.id, body.body);
      return reply.status(201).send(record);
    });
  });

  // --- Mentorship Agendas Endpoints ---

  server.post("/api/v1/mentorship/requests/:id/agendas", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(createAgendaSchema, request.body);
      try {
        const record = await createAgenda(params.id, user.id, body);
        return reply.status(201).send(record);
      } catch (err: any) {
        return reply.badRequest(err.message);
      }
    });
  });

  server.get("/api/v1/mentorship/requests/:id/agendas", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const requestRecord = await one<any>(
        `select user_id, mentor_id from app.mentorship_requests where id = $1`,
        [params.id]
      );
      if (!requestRecord) return reply.notFound("Mentorship request not found.");
      const reqUserId = Number(requestRecord.user_id);
      const reqMentorId = Number(requestRecord.mentor_id);
      const isStaff = ["admin", "moderator"].includes(user.role);
      if (reqUserId !== user.id && reqMentorId !== user.id && !isStaff) {
        return reply.forbidden("You are not authorized to view agendas for this request.");
      }
      return listAgendas(params.id);
    });
  });

  server.put("/api/v1/mentorship/agendas/:id/agree", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      try {
        return await agreeToAgenda(params.id, user.id);
      } catch (err: any) {
        return reply.badRequest(err.message);
      }
    });
  });

  server.put("/api/v1/mentorship/agendas/:id/solve-propose", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      try {
        return await proposeSolveAgenda(params.id, user.id);
      } catch (err: any) {
        return reply.badRequest(err.message);
      }
    });
  });

  server.put("/api/v1/mentorship/agendas/:id/solve-confirm", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      try {
        return await confirmSolveAgenda(params.id, user.id);
      } catch (err: any) {
        return reply.badRequest(err.message);
      }
    });
  });

  server.delete("/api/v1/mentorship/agendas/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      try {
        return await deleteAgenda(params.id, user.id);
      } catch (err: any) {
        return reply.badRequest(err.message);
      }
    });
  });

  // --- Notifications Endpoints ---

  server.get("/api/v1/notifications", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const queryParams = (request.query || {}) as { limit?: string };
      const limit = queryParams.limit ? Number(queryParams.limit) : 50;
      return listNotifications(user.id, limit);
    });
  });

  server.put("/api/v1/notifications/mark-all-read", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      return markAllNotificationsAsRead(user.id);
    });
  });

  server.put("/api/v1/notifications/:id/read", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await markNotificationAsRead(user.id, params.id);
      if (!record) return reply.notFound("Notification not found or not owned by you.");
      return record;
    });
  });

  // --- Settings Endpoints ---

  server.get("/api/v1/mentorship/settings", async (request, reply) => {
    return withValidation(reply, async () => {
      return await getMentorshipSettings();
    });
  });

  server.put("/api/v1/admin/mentorship/settings", async (request, reply) => {
    const user = await requireRole(request, ["admin", "moderator"]);
    return withValidation(reply, async () => {
      const body = parse(updateMentorshipSettingSchema, request.body);
      const record = await updateMentorshipSetting(body.key, body.value);
      return record;
    });
  });
}

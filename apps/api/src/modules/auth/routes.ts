import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAuth, requireRole } from "./guards.js";
import {
  changePasswordSchema,
  confirmEmailSchema,
  googleLoginSchema,
  listUsersQuerySchema,
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  updateUserAdminSchema
} from "./schemas.js";
import { listUsers, loginOrRegisterGoogleUser, loginUser, registerUser, updateUserAdmin } from "./service.js";
import {
  changePassword,
  confirmEmailVerification,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail
} from "./account.service.js";

export async function registerAuthRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/v1/auth/register", async (request, reply) => {
    return withValidation(reply, async () => {
      const body = parse(registerSchema, request.body);
      const result = await registerUser(body);
      // Best-effort: a failed/unconfigured send must not break registration.
      void sendVerificationEmail(result.user.id).catch((err) =>
        request.log.warn({ err }, "Failed to send verification email on registration")
      );
      return reply.status(201).send(result);
    });
  });

  server.post("/api/v1/auth/login", async (request, reply) => {
    return withValidation(reply, async () => {
      const body = parse(loginSchema, request.body);
      return loginUser(body);
    });
  });

  server.post("/api/v1/auth/google", async (request, reply) => {
    return withValidation(reply, async () => {
      const body = parse(googleLoginSchema, request.body);
      return loginOrRegisterGoogleUser(body.id_token);
    });
  });

  server.get("/api/v1/auth/me", async (request) => {
    return requireAuth(request);
  });

  // -------------------------------------------------------------------------
  // Email verification
  // -------------------------------------------------------------------------

  /** Send (or resend) a verification link to the signed-in user's address. */
  server.post("/api/v1/auth/verify-email/send", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const result = await sendVerificationEmail(user.id);
      // Deliberately not an error when SMTP is unconfigured — surface the
      // reason so the UI can explain, without failing the request.
      return { sent: result.sent, reason: result.reason ?? null };
    });
  });

  /** Confirm a verification token (public — the user clicks this from email). */
  server.post("/api/v1/auth/verify-email/confirm", async (request, reply) => {
    return withValidation(reply, async () => {
      const body = parse(confirmEmailSchema, request.body);
      const result = await confirmEmailVerification(body.token);
      if (!result.ok) {
        return reply.status(400).send({
          error: "invalid_token",
          message: "This verification link is invalid or has expired. Request a new one."
        });
      }
      return { verified: true };
    });
  });

  // -------------------------------------------------------------------------
  // Password reset / change
  // -------------------------------------------------------------------------

  /** Always reports success, so this can't be used to enumerate accounts. */
  server.post("/api/v1/auth/forgot-password", async (request, reply) => {
    return withValidation(reply, async () => {
      const body = parse(requestPasswordResetSchema, request.body);
      await requestPasswordReset(body.email);
      return {
        ok: true,
        message: "If an account exists for that address, a reset link has been sent."
      };
    });
  });

  server.post("/api/v1/auth/reset-password", async (request, reply) => {
    return withValidation(reply, async () => {
      const body = parse(resetPasswordSchema, request.body);
      const result = await resetPassword(body.token, body.password);
      if (!result.ok) {
        return reply.status(400).send({
          error: "invalid_token",
          message: "This reset link is invalid or has expired. Request a new one."
        });
      }
      return { ok: true };
    });
  });

  server.post("/api/v1/auth/change-password", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(changePasswordSchema, request.body);
      const result = await changePassword(user.id, body.current_password, body.new_password);
      if (!result.ok) {
        const message =
          result.reason === "google_account"
            ? "This account signs in with Google and has no password to change."
            : "Your current password is incorrect.";
        return reply.status(400).send({ error: result.reason, message });
      }
      return { ok: true };
    });
  });

  server.get("/api/v1/admin/users", async (request, reply) => {
    await requireRole(request, ["admin"]);
    return withValidation(reply, async () => {
      const query = parse(listUsersQuerySchema, request.query);
      return listUsers(query);
    });
  });

  server.patch("/api/v1/admin/users/:id", async (request, reply) => {
    const actor = await requireRole(request, ["admin"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateUserAdminSchema, request.body);
      const record = await updateUserAdmin(params.id, body, actor.id);
      if (!record) return reply.notFound("User not found.");
      return record;
    });
  });
}

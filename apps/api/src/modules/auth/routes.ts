import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAuth, requireRole } from "./guards.js";
import { googleLoginSchema, listUsersQuerySchema, loginSchema, registerSchema, updateUserAdminSchema } from "./schemas.js";
import { listUsers, loginOrRegisterGoogleUser, loginUser, registerUser, updateUserAdmin } from "./service.js";

export async function registerAuthRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/v1/auth/register", async (request, reply) => {
    return withValidation(reply, async () => {
      const body = parse(registerSchema, request.body);
      const result = await registerUser(body);
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

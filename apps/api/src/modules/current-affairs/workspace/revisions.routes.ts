import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAdminOrEditor, requireAuth } from "../../auth/guards.js";
import {
  generateRevisionNotificationsSchema,
  listRevisionNotificationsQuerySchema,
  updateRevisionNotificationSchema
} from "../schemas.js";
import {
  generateRevisionNotifications,
  listRevisionNotifications,
  updateRevisionNotification
} from "./revisions.service.js";

export async function registerCurrentAffairsRevisionRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/me/revision-notifications", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const query = parse(listRevisionNotificationsQuerySchema, request.query);
      return listRevisionNotifications(user.id, query);
    });
  });

  server.patch("/api/v1/current-affairs/me/revision-notifications/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateRevisionNotificationSchema, request.body);
      const record = await updateRevisionNotification(params.id, body, user.id);
      if (!record) return reply.notFound("Revision notification not found.");
      return record;
    });
  });

  server.post("/api/v1/current-affairs/admin/revision-notifications/generate", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(generateRevisionNotificationsSchema, request.body ?? {});
      const records = await generateRevisionNotifications(body);
      return reply.status(201).send(records);
    });
  });
}

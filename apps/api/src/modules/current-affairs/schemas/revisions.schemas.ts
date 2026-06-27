import { z } from "zod";
import { listQuerySchema } from "../../../common/http.js";

export const revisionNotificationStatusSchema = z.enum(["pending", "sent", "read", "dismissed"]);

export const listRevisionNotificationsQuerySchema = listQuerySchema.extend({
  status: revisionNotificationStatusSchema.optional(),
  due_only: z.coerce.boolean().default(false)
});

export const generateRevisionNotificationsSchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

export const updateRevisionNotificationSchema = z.object({
  status: z.enum(["read", "dismissed", "sent"])
});

export type ListRevisionNotificationsQuery = z.output<typeof listRevisionNotificationsQuerySchema>;
export type GenerateRevisionNotificationsInput = z.output<typeof generateRevisionNotificationsSchema>;
export type UpdateRevisionNotificationInput = z.output<typeof updateRevisionNotificationSchema>;

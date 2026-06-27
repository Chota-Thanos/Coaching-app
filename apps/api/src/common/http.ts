import type { FastifyReply } from "fastify";
import { z, ZodError, type ZodTypeAny } from "zod";

export function parse<TSchema extends ZodTypeAny>(schema: TSchema, data: unknown): z.output<TSchema> {
  return schema.parse(data);
}

export function handleValidation(error: unknown, reply: FastifyReply): boolean {
  if (error instanceof ZodError) {
    reply.status(400).send({
      error: "validation_error",
      issues: error.issues
    });
    return true;
  }
  return false;
}

export async function withValidation(
  reply: FastifyReply,
  handler: () => Promise<unknown>
): Promise<unknown> {
  try {
    return await handler();
  } catch (error) {
    if (handleValidation(error, reply)) return undefined;
    throw error;
  }
}

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});


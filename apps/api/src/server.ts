import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import { mkdir } from "node:fs/promises";
import { config } from "./config.js";
import { registerAssessmentRoutes } from "./modules/assessment/routes.js";
import { registerMainsAssessmentRoutes } from "./modules/assessment/mains.routes.js";
import { registerQuestionImportRoutes } from "./modules/assessment/imports.routes.js";
import { registerReviewRoutes } from "./modules/assessment/review.routes.js";
import { registerTestSeriesRoutes } from "./modules/assessment/series.routes.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerBillingRoutes } from "./modules/billing/routes.js";
import { registerRazorpayWebhookRoute } from "./modules/billing/webhook.js";
import { registerCurrentAffairsRoutes } from "./modules/current-affairs/routes.js";
import { registerMediaRoutes } from "./modules/media/routes.js";
import { getMediaStaticPrefix, getMediaUploadRoot, MEDIA_MAX_FILE_SIZE_BYTES } from "./modules/media/storage.js";
import { registerStudyPlanRoutes } from "./modules/study-plans/routes.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMentorshipRoutes } from "./modules/mentorship/routes.js";

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: config.LOG_LEVEL
    },
    bodyLimit: 52428800 // 50MB
  });

  await server.register(sensible);
  await server.register(helmet, {
    crossOriginResourcePolicy: { policy: "cross-origin" }
  });
  await server.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
      if (config.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed"), false);
    },
    credentials: true
  });
  await server.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute"
  });
  await server.register(multipart, {
    limits: {
      fileSize: MEDIA_MAX_FILE_SIZE_BYTES,
      files: 1
    },
    throwFileSizeLimit: true
  });

  const mediaUploadRoot = getMediaUploadRoot();
  await mkdir(mediaUploadRoot, { recursive: true });
  await server.register(fastifyStatic, {
    root: mediaUploadRoot,
    prefix: getMediaStaticPrefix(),
    decorateReply: false
  });

  await server.register(swagger, {
    openapi: {
      info: {
        title: "Coaching App API",
        version: "0.1.0"
      }
    }
  });
  await server.register(swaggerUi, {
    routePrefix: "/docs"
  });

  server.setErrorHandler((error: Error & { statusCode?: number; code?: string; detail?: string }, request, reply) => {
    request.log.error(error);

    if (["TokenExpiredError", "JsonWebTokenError", "NotBeforeError"].includes(error.name)) {
      return reply.status(401).send({
        error: "unauthorized",
        message: "Invalid or expired token."
      });
    }

    const pgError = error as Error & { code?: string; detail?: string };
    if (pgError.code === "23505") {
      return reply.status(409).send({
        error: "conflict",
        message: "A record with the same unique value already exists.",
        detail: pgError.detail
      });
    }

    if (pgError.code === "23503") {
      return reply.status(400).send({
        error: "invalid_reference",
        message: "One of the referenced records does not exist.",
        detail: pgError.detail
      });
    }

    if (pgError.code === "23514" || pgError.code === "P0001") {
      return reply.status(400).send({
        error: "constraint_failed",
        message: pgError.message
      });
    }

    if (typeof error.statusCode === "number") {
      return reply.status(error.statusCode).send({
        error: error.name,
        message: error.message
      });
    }

    return reply.status(500).send({
      error: "internal_server_error",
      message: "Unexpected server error."
    });
  });

  await registerHealthRoutes(server);
  await registerAuthRoutes(server);
  await registerMediaRoutes(server);
  await registerBillingRoutes(server);
  await registerRazorpayWebhookRoute(server);
  await registerAssessmentRoutes(server);
  await registerMainsAssessmentRoutes(server);
  await registerTestSeriesRoutes(server);
  await registerReviewRoutes(server);
  await registerQuestionImportRoutes(server);
  await registerStudyPlanRoutes(server);
  await registerCurrentAffairsRoutes(server);
  await registerMentorshipRoutes(server);

  return server;
}

import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor } from "../auth/guards.js";
import {
  createExamLevelSchema,
  createExamSchema,
  createQuestionFormatSchema,
  createQuestionNatureSchema,
  createTaxonomyNodeSchema,
  examIdParamSchema,
  listQuestionFormatsQuerySchema,
  listQuestionNaturesQuerySchema,
  listQuerySchema,
  listTaxonomyNodesQuerySchema,
  updateExamLevelSchema,
  updateExamSchema,
  updateQuestionFormatSchema,
  updateQuestionNatureSchema,
  updateTaxonomyNodeSchema
} from "./schemas.js";
import {
  createExam,
  createExamLevel,
  createQuestionFormat,
  createQuestionNature,
  createTaxonomyNode,
  deleteExam,
  listExamLevels,
  listExams,
  listQuestionFormats,
  listQuestionNatures,
  listTaxonomyNodes,
  updateExam,
  updateExamLevel,
  updateQuestionFormat,
  updateQuestionNature,
  updateTaxonomyNode,
  deleteTaxonomyNode,
  deleteExamLevel,
  deleteQuestionNature
} from "./catalog.service.js";

export async function registerAssessmentCatalogRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/assessment/exams", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(listQuerySchema, request.query);
      return listExams(query);
    });
  });

  server.post("/api/v1/assessment/exams", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createExamSchema, request.body);
      const record = await createExam(body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/assessment/exams/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateExamSchema, request.body);
      const record = await updateExam(params.id, body);
      if (!record) return reply.notFound("Exam not found.");
      return record;
    });
  });

  server.delete("/api/v1/assessment/exams/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const success = await deleteExam(params.id);
      if (!success) return reply.notFound("Exam not found.");
      return { success: true };
    });
  });

  server.get("/api/v1/assessment/exams/:examId/levels", async (request, reply) => {
    return withValidation(reply, async () => {
      const params = parse(examIdParamSchema, request.params);
      const query = parse(listQuerySchema, request.query);
      return listExamLevels(params.examId, query);
    });
  });

  server.post("/api/v1/assessment/exams/:examId/levels", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(examIdParamSchema, request.params);
      const body = parse(createExamLevelSchema, request.body);
      const record = await createExamLevel(params.examId, body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/assessment/exam-levels/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateExamLevelSchema, request.body);
      const record = await updateExamLevel(params.id, body);
      if (!record) return reply.notFound("Exam level not found.");
      return record;
    });
  });

  server.delete("/api/v1/assessment/exam-levels/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const success = await deleteExamLevel(params.id);
      if (!success) return reply.notFound("Exam level not found.");
      return { success: true };
    });
  });

  server.get("/api/v1/assessment/question-formats", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(listQuestionFormatsQuerySchema, request.query);
      return listQuestionFormats(query);
    });
  });

  server.post("/api/v1/assessment/question-formats", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createQuestionFormatSchema, request.body);
      const record = await createQuestionFormat(body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/assessment/question-formats/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateQuestionFormatSchema, request.body);
      const record = await updateQuestionFormat(params.id, body);
      if (!record) return reply.notFound("Question format not found.");
      return record;
    });
  });

  server.get("/api/v1/assessment/taxonomy-nodes", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(listTaxonomyNodesQuerySchema, request.query);
      return listTaxonomyNodes(query);
    });
  });

  server.post("/api/v1/assessment/taxonomy-nodes", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createTaxonomyNodeSchema, request.body);
      const record = await createTaxonomyNode(body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/assessment/taxonomy-nodes/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateTaxonomyNodeSchema, request.body);
      const record = await updateTaxonomyNode(params.id, body);
      if (!record) return reply.notFound("Taxonomy node not found.");
      return record;
    });
  });

  server.delete("/api/v1/assessment/taxonomy-nodes/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const success = await deleteTaxonomyNode(params.id);
      if (!success) return reply.notFound("Taxonomy node not found.");
      return { success: true };
    });
  });

  server.get("/api/v1/assessment/question-natures", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(listQuestionNaturesQuerySchema, request.query);
      return listQuestionNatures(query);
    });
  });

  server.post("/api/v1/assessment/question-natures", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createQuestionNatureSchema, request.body);
      const record = await createQuestionNature(body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/assessment/question-natures/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateQuestionNatureSchema, request.body);
      const record = await updateQuestionNature(params.id, body);
      if (!record) return reply.notFound("Question nature not found.");
      return record;
    });
  });

  server.delete("/api/v1/assessment/question-natures/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const success = await deleteQuestionNature(params.id);
      if (!success) return reply.notFound("Question nature not found.");
      return { success: true };
    });
  });
}

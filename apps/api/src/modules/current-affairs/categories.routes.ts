import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor } from "../auth/guards.js";
import {
  bulkCreateCategories,
  bulkReassignCategories,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory
} from "./categories.service.js";
import {
  bulkCreateCategorySchema,
  bulkReassignCategorySchema,
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema
} from "./schemas.js";

function bulkReassignErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;

  switch (error.message) {
    case "category_parent_cannot_be_self":
      return "A category cannot be moved under itself.";
    case "category_parent_not_found":
      return "The selected parent category was not found.";
    case "category_parent_family_mismatch":
      return "The new parent must belong to the same content family.";
    case "category_parent_cannot_be_descendant":
      return "A category cannot be moved under its own child category.";
    case "bulk_reassign_same_family_required":
      return "Select categories from one content family before reassigning.";
    case "bulk_reassign_parent_cannot_be_selected":
      return "The new parent cannot be one of the selected categories.";
    case "bulk_reassign_parent_not_found":
      return "The selected parent category was not found.";
    case "bulk_reassign_parent_family_mismatch":
      return "The new parent must belong to the same content family.";
    case "bulk_reassign_parent_cannot_be_descendant":
      return "A category cannot be moved under its own child category.";
    default:
      return null;
  }
}

export async function registerCurrentAffairsCategoryRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/categories", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(listCategoriesQuerySchema, request.query);
      return listCategories(query);
    });
  });

  server.post("/api/v1/current-affairs/categories", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createCategorySchema, request.body);
      const record = await createCategory(body);
      return reply.status(201).send(record);
    });
  });

  server.post("/api/v1/current-affairs/categories/bulk", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(bulkCreateCategorySchema, request.body);
      const records = await bulkCreateCategories(body);
      return reply.status(201).send(records);
    });
  });

  server.patch("/api/v1/current-affairs/categories/bulk-reassign", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(bulkReassignCategorySchema, request.body);
      try {
        const records = await bulkReassignCategories(body);
        if (!records) return reply.badRequest("Some selected categories were not found.");
        return records;
      } catch (error) {
        const message = bulkReassignErrorMessage(error);
        if (message) return reply.badRequest(message);
        throw error;
      }
    });
  });

  server.patch("/api/v1/current-affairs/categories/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateCategorySchema, request.body);
      try {
        const record = await updateCategory(params.id, body);
        if (!record) return reply.notFound("Current affairs category not found.");
        return record;
      } catch (error) {
        const message = bulkReassignErrorMessage(error);
        if (message) return reply.badRequest(message);
        throw error;
      }
    });
  });

  server.delete("/api/v1/current-affairs/categories/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteCategory(params.id);
      if (!record) return reply.notFound("Category not found.");
      return record;
    });
  });
}

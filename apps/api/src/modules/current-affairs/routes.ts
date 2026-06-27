import type { FastifyInstance } from "fastify";
import { registerCurrentAffairsCategoryRoutes } from "./categories.routes.js";
import { registerCurrentAffairsMasterArticleRoutes } from "./master-articles.routes.js";
import { registerCurrentAffairsWorkspaceRoutes } from "./workspace.routes.js";

export async function registerCurrentAffairsRoutes(server: FastifyInstance): Promise<void> {
  await registerCurrentAffairsCategoryRoutes(server);
  await registerCurrentAffairsMasterArticleRoutes(server);
  await registerCurrentAffairsWorkspaceRoutes(server);
}


import type { FastifyInstance } from "fastify";
import { registerCurrentAffairsAssetRoutes } from "./master/assets.routes.js";
import { registerCurrentAffairsArticleRoutes } from "./master/articles.routes.js";
import { registerCurrentAffairsDiscoveryRoutes } from "./master/discovery.routes.js";
import { registerCurrentAffairsFrontendReadRoutes } from "./master/frontend-read.routes.js";
import { registerCurrentAffairsIngestionRoutes } from "./master/ingestion.routes.js";
import { registerCurrentAffairsPostingAgentRoutes } from "./master/posting-agent.routes.js";
import { registerCurrentAffairsQuestionGenerationRoutes } from "./master/question-generation.routes.js";
import { registerCurrentAffairsRelationRoutes } from "./master/relations.routes.js";
import { registerCurrentAffairsSectionRoutes } from "./master/sections.routes.js";
import { registerCurrentAffairsUpdateRoutes } from "./master/updates.routes.js";

export async function registerCurrentAffairsMasterArticleRoutes(server: FastifyInstance): Promise<void> {
  await registerCurrentAffairsDiscoveryRoutes(server);
  await registerCurrentAffairsFrontendReadRoutes(server);
  await registerCurrentAffairsArticleRoutes(server);
  await registerCurrentAffairsAssetRoutes(server);
  await registerCurrentAffairsIngestionRoutes(server);
  await registerCurrentAffairsPostingAgentRoutes(server);
  await registerCurrentAffairsQuestionGenerationRoutes(server);
  await registerCurrentAffairsRelationRoutes(server);
  await registerCurrentAffairsSectionRoutes(server);
  await registerCurrentAffairsUpdateRoutes(server);
}

import type { FastifyInstance } from "fastify";
import { registerAssessmentCatalogRoutes } from "./catalog.routes.js";
import { registerAssessmentQuestionRoutes } from "./questions.routes.js";
import { registerAssessmentTestRoutes } from "./tests.routes.js";
import { registerAssessmentAiSettingsRoutes } from "./ai-settings.routes.js";
import { registerOnboardingTourRoutes } from "./onboarding-tours.routes.js";
import { registerHomeCollectionRoutes } from "./home-collections.routes.js";
import { registerAssessmentPostingAgentRoutes } from "./posting-agent.routes.js";

export async function registerAssessmentRoutes(server: FastifyInstance): Promise<void> {
  await registerAssessmentCatalogRoutes(server);
  await registerAssessmentQuestionRoutes(server);
  await registerAssessmentTestRoutes(server);
  await registerAssessmentAiSettingsRoutes(server);
  await registerOnboardingTourRoutes(server);
  await registerHomeCollectionRoutes(server);
  await registerAssessmentPostingAgentRoutes(server);
}


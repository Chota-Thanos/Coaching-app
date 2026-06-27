import type { FastifyInstance } from "fastify";
import { registerCurrentAffairsAnnotationRoutes } from "./workspace/annotations.routes.js";
import { registerCurrentAffairsCollectionRoutes } from "./workspace/collections.routes.js";
import { registerCurrentAffairsForkRoutes } from "./workspace/forks.routes.js";
import { registerCurrentAffairsReadingRoutes } from "./workspace/reading.routes.js";
import { registerCurrentAffairsRevisionRoutes } from "./workspace/revisions.routes.js";
import { registerCurrentAffairsStudentArticleRoutes } from "./workspace/student-articles.routes.js";

export async function registerCurrentAffairsWorkspaceRoutes(server: FastifyInstance): Promise<void> {
  await registerCurrentAffairsForkRoutes(server);
  await registerCurrentAffairsReadingRoutes(server);
  await registerCurrentAffairsRevisionRoutes(server);
  await registerCurrentAffairsAnnotationRoutes(server);
  await registerCurrentAffairsStudentArticleRoutes(server);
  await registerCurrentAffairsCollectionRoutes(server);
}

import type { FastifyInstance } from "fastify";
import { requireAdminOrEditor, requireAuth } from "../auth/guards.js";
import { one, query } from "../../db.js";
import { withValidation } from "../../common/http.js";

export async function registerOnboardingTourRoutes(server: FastifyInstance): Promise<void> {

  // ─── PUBLIC: Fetch tour steps by key ───────────────────────────────────────
  // GET /api/v1/onboarding/tours?key=custom_test_tour
  // Returns: { tour, steps[] } or null if tour not found
  server.get("/api/v1/onboarding/tours", async (request, reply) => {
    return withValidation(reply, async () => {
      const { key } = request.query as { key?: string };
      if (!key) return reply.badRequest("key query param is required.");

      const tour = await one<{
        id: number; key: string; name: string; version: number; is_active: boolean;
      }>(
        `select id, key, name, version, is_active from app.onboarding_tours where key = $1`,
        [key]
      );
      if (!tour || !tour.is_active) return reply.notFound("Tour not found.");

      const steps = await query<{
        id: number; display_order: number; selector: string; badge: string;
        title: string; body: string; action_trigger: string | null; action_text: string | null;
      }>(
        `select id, display_order, selector, badge, title, body, action_trigger, action_text
         from app.onboarding_tour_steps
         where tour_id = $1
         order by display_order asc`,
        [tour.id]
      );

      return { tour, steps };
    });
  });

  // ─── PUBLIC (AUTHENTICATED): Check if user has completed a tour ─────────────
  // GET /api/v1/onboarding/tours/:key/completion
  server.get("/api/v1/onboarding/tours/:key/completion", async (request, reply) => {
    return withValidation(reply, async () => {
      const user = await requireAuth(request);
      const { key } = request.params as { key: string };

      // Fetch tour version
      const tour = await one<{ version: number }>(
        `select version from app.onboarding_tours where key = $1 and is_active = true`,
        [key]
      );
      if (!tour) return { completed: false, tour_version: 1, user_version: null };

      const completion = await one<{ tour_version: number }>(
        `select tour_version from app.user_onboarding_completions where user_id = $1 and tour_key = $2`,
        [user.id, key]
      );

      // completed = user has completed same or newer version of the tour
      const completed = completion !== null && completion.tour_version >= tour.version;
      return { completed, tour_version: tour.version, user_version: completion?.tour_version ?? null };
    });
  });

  // ─── AUTHENTICATED: Mark tour as completed ──────────────────────────────────
  // POST /api/v1/onboarding/tours/:key/complete
  server.post("/api/v1/onboarding/tours/:key/complete", async (request, reply) => {
    return withValidation(reply, async () => {
      const user = await requireAuth(request);
      const { key } = request.params as { key: string };

      const tour = await one<{ version: number }>(
        `select version from app.onboarding_tours where key = $1`,
        [key]
      );
      if (!tour) return reply.notFound("Tour not found.");

      // Upsert completion record (update version if already exists)
      await one(
        `insert into app.user_onboarding_completions (user_id, tour_key, tour_version)
         values ($1, $2, $3)
         on conflict (user_id, tour_key) do update set tour_version = $3, completed_at = now()
         returning id`,
        [user.id, key, tour.version]
      );

      return { success: true };
    });
  });

  // ─── ADMIN: List all tours ──────────────────────────────────────────────────
  // GET /api/v1/onboarding/admin/tours
  server.get("/api/v1/onboarding/admin/tours", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const tours = await query(
        `select t.*, count(s.id)::int as step_count
         from app.onboarding_tours t
         left join app.onboarding_tour_steps s on s.tour_id = t.id
         group by t.id
         order by t.created_at asc`
      );
      return tours;
    });
  });

  // ─── ADMIN: Get a single tour with its steps ────────────────────────────────
  // GET /api/v1/onboarding/admin/tours/:key
  server.get("/api/v1/onboarding/admin/tours/:key", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const { key } = request.params as { key: string };
      const tour = await one(`select * from app.onboarding_tours where key = $1`, [key]);
      if (!tour) return reply.notFound("Tour not found.");

      const steps = await query(
        `select * from app.onboarding_tour_steps where tour_id = $1 order by display_order asc`,
        [(tour as any).id]
      );
      return { tour, steps };
    });
  });

  // ─── ADMIN: Update tour metadata (name, version, is_active) ────────────────
  // PATCH /api/v1/onboarding/admin/tours/:key
  server.patch("/api/v1/onboarding/admin/tours/:key", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const { key } = request.params as { key: string };
      const { name, version, is_active } = request.body as {
        name?: string; version?: number; is_active?: boolean;
      };

      const tour = await one(
        `update app.onboarding_tours
         set name = coalesce($2, name),
             version = coalesce($3, version),
             is_active = coalesce($4, is_active)
         where key = $1
         returning *`,
        [key, name ?? null, version ?? null, is_active ?? null]
      );
      if (!tour) return reply.notFound("Tour not found.");
      return tour;
    });
  });

  // ─── ADMIN: Bulk-save steps for a tour (replaces all existing steps) ────────
  // PUT /api/v1/onboarding/admin/tours/:key/steps
  // Body: { steps: TourStep[] } — full ordered list, indices become display_order
  server.put("/api/v1/onboarding/admin/tours/:key/steps", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const { key } = request.params as { key: string };
      const { steps } = request.body as {
        steps: Array<{
          selector: string; badge: string; title: string; body: string;
          action_trigger?: string; action_text?: string;
        }>;
      };

      if (!Array.isArray(steps)) return reply.badRequest("steps must be an array.");

      const tour = await one<{ id: number; version: number }>(
        `select id, version from app.onboarding_tours where key = $1`,
        [key]
      );
      if (!tour) return reply.notFound("Tour not found.");

      // Delete old steps and re-insert in one transaction
      await one(`delete from app.onboarding_tour_steps where tour_id = $1`, [tour.id]);

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        if (!s.selector || !s.title || !s.body) continue;
        await one(
          `insert into app.onboarding_tour_steps
           (tour_id, display_order, selector, badge, title, body, action_trigger, action_text)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [tour.id, i, s.selector, s.badge ?? "", s.title, s.body,
           s.action_trigger ?? null, s.action_text ?? null]
        );
      }

      // Return the updated steps
      const savedSteps = await query(
        `select * from app.onboarding_tour_steps where tour_id = $1 order by display_order asc`,
        [tour.id]
      );
      return { tour, steps: savedSteps };
    });
  });
}

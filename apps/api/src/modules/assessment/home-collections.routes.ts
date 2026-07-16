import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor } from "../auth/guards.js";
import { one, query, transaction } from "../../db.js";

const createCollectionSchema = z.object({
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  subtitle: z.string().trim().optional(),
  cover_image_url: z.string().trim().url().optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.boolean().optional()
});

const updateCollectionSchema = createCollectionSchema.partial();

const collectionItemSchema = z.object({
  taxonomy_type: z.enum(["objective", "mains"]),
  node_id: z.coerce.number().int().positive(),
  cover_image_url: z.string().trim().url().optional()
});

const replaceItemsSchema = z.object({
  items: z.array(collectionItemSchema)
});

// Resolves each item's display name/image/node_type against whichever taxonomy
// tree it belongs to, plus a lightweight recursive question count so Home
// cards can show "N questions" without a second round trip.
async function resolveItems(collectionId: number): Promise<unknown[]> {
  return query(
    `
      select
        hci.id,
        hci.taxonomy_type,
        hci.node_id,
        hci.display_order,
        coalesce(hci.cover_image_url, node.image_url, mnode.image_url) as cover_image_url,
        coalesce(node.name, mnode.name) as name,
        coalesce(node.node_type, mnode.node_type) as node_type,
        coalesce(node.exam_id, mnode.exam_id) as exam_id,
        (
          case when hci.taxonomy_type = 'objective' then (
            with recursive descendants as (
              select id from assessment.assessment_taxonomy_nodes where id = hci.node_id
              union all
              select child.id from assessment.assessment_taxonomy_nodes child
              join descendants d on child.parent_id = d.id
            )
            select count(*)::int
            from assessment.questions q
            join assessment.question_taxonomy_links qtl on qtl.question_id = q.id
            where q.status = 'published' and q.question_family = 'objective'
              and (
                qtl.subject_node_id in (select id from descendants)
                or qtl.source_node_id in (select id from descendants)
                or qtl.topic_node_id in (select id from descendants)
                or qtl.subtopic_node_id in (select id from descendants)
              )
          ) else (
            with recursive descendants as (
              select id from assessment.mains_taxonomy_nodes where id = hci.node_id
              union all
              select child.id from assessment.mains_taxonomy_nodes child
              join descendants d on child.parent_id = d.id
            )
            select count(*)::int
            from assessment.questions q
            join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = q.id
            where q.status = 'published' and q.question_family = 'mains_subjective'
              and (
                mqtl.paper_node_id in (select id from descendants)
                or mqtl.subject_area_node_id in (select id from descendants)
                or mqtl.theme_node_id in (select id from descendants)
                or mqtl.topic_node_id in (select id from descendants)
                or mqtl.subtopic_node_id in (select id from descendants)
              )
          ) end
        ) as available_questions
      from app.home_collection_items hci
      left join assessment.assessment_taxonomy_nodes node
        on hci.taxonomy_type = 'objective' and node.id = hci.node_id
      left join assessment.mains_taxonomy_nodes mnode
        on hci.taxonomy_type = 'mains' and mnode.id = hci.node_id
      where hci.collection_id = $1
      order by hci.display_order asc
    `,
    [collectionId]
  );
}

export async function registerHomeCollectionRoutes(server: FastifyInstance): Promise<void> {
  // ─── PUBLIC: active collections with resolved items, for the Home screen ───
  server.get("/api/v1/assessment/home-collections", async (_request, reply) => {
    return withValidation(reply, async () => {
      const collections = await query<{ id: number }>(
        `
          select id, slug, title, subtitle, cover_image_url, display_order
          from app.home_collections
          where is_active = true
          order by display_order asc, title asc
        `
      );
      const withItems = await Promise.all(
        collections.map(async (c) => ({ ...c, items: await resolveItems(c.id) }))
      );
      return withItems;
    });
  });

  // ─── ADMIN: list all collections with item counts ───────────────────────
  server.get("/api/v1/assessment/admin/home-collections", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      return query(
        `
          select c.*, count(i.id)::int as item_count
          from app.home_collections c
          left join app.home_collection_items i on i.collection_id = c.id
          group by c.id
          order by c.display_order asc, c.title asc
        `
      );
    });
  });

  // ─── ADMIN: create a collection ──────────────────────────────────────────
  server.post("/api/v1/assessment/admin/home-collections", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createCollectionSchema, request.body);
      const record = await one(
        `
          insert into app.home_collections (slug, title, subtitle, cover_image_url, display_order, is_active)
          values ($1, $2, $3, $4, coalesce($5, 0), coalesce($6, true))
          returning *
        `,
        [body.slug, body.title, body.subtitle ?? null, body.cover_image_url ?? null, body.display_order ?? null, body.is_active ?? null]
      );
      return reply.status(201).send(record);
    });
  });

  // ─── ADMIN: update a collection's metadata ───────────────────────────────
  server.patch("/api/v1/assessment/admin/home-collections/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateCollectionSchema, request.body);
      const record = await one(
        `
          update app.home_collections
          set slug = coalesce($2, slug),
              title = coalesce($3, title),
              subtitle = coalesce($4, subtitle),
              cover_image_url = coalesce($5, cover_image_url),
              display_order = coalesce($6, display_order),
              is_active = coalesce($7, is_active)
          where id = $1
          returning *
        `,
        [params.id, body.slug ?? null, body.title ?? null, body.subtitle ?? null, body.cover_image_url ?? null, body.display_order ?? null, body.is_active ?? null]
      );
      if (!record) return reply.notFound("Collection not found.");
      return record;
    });
  });

  // ─── ADMIN: delete a collection (cascades to its items) ──────────────────
  server.delete("/api/v1/assessment/admin/home-collections/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await one(`delete from app.home_collections where id = $1 returning id`, [params.id]);
      if (!record) return reply.notFound("Collection not found.");
      return { success: true };
    });
  });

  // ─── ADMIN: get a collection's items (resolved, for the editor UI) ───────
  server.get("/api/v1/assessment/admin/home-collections/:id/items", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      return resolveItems(params.id);
    });
  });

  // ─── ADMIN: replace a collection's full item list, in order ─────────────
  server.put("/api/v1/assessment/admin/home-collections/:id/items", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(replaceItemsSchema, request.body);

      const collection = await one(`select id from app.home_collections where id = $1`, [params.id]);
      if (!collection) return reply.notFound("Collection not found.");

      await transaction(async (client) => {
        await client.query(`delete from app.home_collection_items where collection_id = $1`, [params.id]);
        for (let i = 0; i < body.items.length; i++) {
          const item = body.items[i];
          if (!item) continue;
          await client.query(
            `
              insert into app.home_collection_items (collection_id, taxonomy_type, node_id, display_order, cover_image_url)
              values ($1, $2, $3, $4, $5)
            `,
            [params.id, item.taxonomy_type, item.node_id, i, item.cover_image_url ?? null]
          );
        }
      });

      return { items: await resolveItems(params.id) };
    });
  });
}

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../server.js";
import { closePool, one } from "../../db.js";
import { signAccessToken } from "../auth/service.js";
import type { AuthUser } from "../auth/schemas.js";

let server: FastifyInstance;
let adminToken: string;
let studentToken: string;
let categoryId: number;
let articleId: number;
let forkId: number;
let collectionId: number;

async function createUser(role: AuthUser["role"], suffix: string): Promise<AuthUser> {
  const user = await one<AuthUser>(
    `
      insert into app.users (email, username, password_hash, role, is_active)
      values ($1, $2, 'test-only', $3, true)
      returning id, email, username, role, is_active
    `,
    [`ca-${suffix}-${Date.now()}@example.test`, `ca_${suffix}_${Date.now()}`, role]
  );

  assert.ok(user);
  return user;
}

function auth(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

before(async () => {
  server = await buildServer();
  const admin = await createUser("admin", "admin");
  const student = await createUser("student", "student");
  adminToken = signAccessToken(admin);
  studentToken = signAccessToken(student);
});

after(async () => {
  await server.close();
  await closePool();
});

test("admin can create category and published article", async () => {
  const suffix = Date.now();

  const categoryResponse = await server.inject({
    method: "POST",
    url: "/api/v1/current-affairs/categories",
    headers: auth(adminToken),
    payload: {
      content_family: "prelims",
      node_type: "subject",
      name: `Test Current Affairs ${suffix}`,
      slug: `test-current-affairs-${suffix}`
    }
  });

  assert.equal(categoryResponse.statusCode, 201);
  categoryId = Number(categoryResponse.json().id);
  assert.ok(categoryId);

  const articleResponse = await server.inject({
    method: "POST",
    url: "/api/v1/current-affairs/articles",
    headers: auth(adminToken),
    payload: {
      content_kind: "daily_current_affairs",
      title: `Policy Update ${suffix}`,
      slug: `policy-update-${suffix}`,
      body: "A concise current affairs update for integration testing.",
      category_node_id: categoryId,
      publication_date: "2026-05-31",
      institute_tags: ["test", "policy"],
      status: "published"
    }
  });

  assert.equal(articleResponse.statusCode, 201);
  articleId = Number(articleResponse.json().id);
  assert.ok(articleId);
});

test("student cannot create institute article", async () => {
  const response = await server.inject({
    method: "POST",
    url: "/api/v1/current-affairs/articles",
    headers: auth(studentToken),
    payload: {
      content_kind: "daily_current_affairs",
      title: "Forbidden Article",
      slug: `forbidden-article-${Date.now()}`,
      body: "Students cannot publish institute articles."
    }
  });

  assert.equal(response.statusCode, 403);
});

test("student can fork article and update reading progress", async () => {
  const forkResponse = await server.inject({
    method: "POST",
    url: `/api/v1/current-affairs/articles/${articleId}/fork`,
    headers: auth(studentToken),
    payload: {
      personal_tags: ["revision"]
    }
  });

  assert.equal(forkResponse.statusCode, 201);
  forkId = Number(forkResponse.json().id);
  assert.ok(forkId);

  const defaultCollectionResponse = await server.inject({
    method: "GET",
    url: "/api/v1/current-affairs/me/collections",
    headers: auth(studentToken)
  });
  assert.equal(defaultCollectionResponse.statusCode, 200);
  const defaultCollection = defaultCollectionResponse.json().find((item: { slug: string }) => item.slug === "undefined-repo");
  assert.ok(defaultCollection);
  assert.equal(defaultCollection.name, "Undefined Repo");

  const progressResponse = await server.inject({
    method: "PUT",
    url: `/api/v1/current-affairs/me/forks/${forkId}/progress`,
    headers: auth(studentToken),
    payload: {
      progress_percent: 100,
      reading_seconds_delta: 120,
      mark_complete: true
    }
  });

  assert.equal(progressResponse.statusCode, 200);
  assert.equal(Number(progressResponse.json().progress_percent), 100);

  const dashboardResponse = await server.inject({
    method: "GET",
    url: "/api/v1/current-affairs/me/reading-dashboard",
    headers: auth(studentToken)
  });

  assert.equal(dashboardResponse.statusCode, 200);
  assert.ok(Number(dashboardResponse.json().stats.completed_articles) >= 1);
});

test("student can organize forked articles into a repository", async () => {
  const suffix = Date.now();
  const collectionResponse = await server.inject({
    method: "POST",
    url: "/api/v1/current-affairs/me/collections",
    headers: auth(studentToken),
    payload: {
      name: `Revision Repository ${suffix}`,
      slug: `revision-repository-${suffix}`,
      description: "Articles grouped for revision.",
      custom_tags: ["Weak topic", "Revise before mock", "Done"]
    }
  });

  assert.equal(collectionResponse.statusCode, 201);
  collectionId = Number(collectionResponse.json().id);
  assert.ok(collectionId);

  const itemResponse = await server.inject({
    method: "POST",
    url: `/api/v1/current-affairs/me/collections/${collectionId}/items`,
    headers: auth(studentToken),
    payload: {
      fork_id: forkId
    }
  });

  assert.equal(itemResponse.statusCode, 201);

  const listResponse = await server.inject({
    method: "GET",
    url: "/api/v1/current-affairs/me/collections",
    headers: auth(studentToken)
  });

  assert.equal(listResponse.statusCode, 200);
  const collection = listResponse.json().find((item: { id: number }) => Number(item.id) === collectionId);
  assert.ok(collection);
  assert.equal(Number(collection.item_count), 1);

  const detailResponse = await server.inject({
    method: "GET",
    url: `/api/v1/current-affairs/me/collections/${collectionId}`,
    headers: auth(studentToken)
  });

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(Number(detailResponse.json().id), collectionId);
  assert.deepEqual(detailResponse.json().custom_tags, ["Weak topic", "Revise before mock", "Done"]);
  assert.equal(detailResponse.json().items.length, 1);
  assert.equal(Number(detailResponse.json().items[0].master_article.id), articleId);
});

test("frontend read endpoints expose paginated lists, filters, and slug detail", async () => {
  const listResponse = await server.inject({
    method: "GET",
    url: `/api/v1/current-affairs/frontend/articles?content_kind=daily_current_affairs&category=${categoryId}&page=1&limit=5`
  });

  assert.equal(listResponse.statusCode, 200);
  assert.ok(Array.isArray(listResponse.json().items));
  assert.ok(Number(listResponse.json().total) >= 1);

  const filtersResponse = await server.inject({
    method: "GET",
    url: "/api/v1/current-affairs/frontend/filters?content_kind=daily_current_affairs&content_family=prelims"
  });

  assert.equal(filtersResponse.statusCode, 200);
  assert.ok(Array.isArray(filtersResponse.json().categories));
  assert.ok(Array.isArray(filtersResponse.json().months));

  const article = listResponse.json().items.find((item: { id: number }) => Number(item.id) === articleId);
  assert.ok(article);

  const detailResponse = await server.inject({
    method: "GET",
    url: `/api/v1/current-affairs/articles/slug/${article.slug}`
  });

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(Number(detailResponse.json().id), articleId);
});

test("admin can create article asset and ingestion job", async () => {
  const assetResponse = await server.inject({
    method: "POST",
    url: `/api/v1/current-affairs/articles/${articleId}/assets`,
    headers: auth(adminToken),
    payload: {
      asset_type: "thumbnail",
      file_name: "thumbnail.jpg",
      file_url: "https://example.test/thumbnail.jpg",
      mime_type: "image/jpeg"
    }
  });

  assert.equal(assetResponse.statusCode, 201);

  const ingestionResponse = await server.inject({
    method: "POST",
    url: "/api/v1/current-affairs/admin/ingestion-jobs",
    headers: auth(adminToken),
    payload: {
      raw_text: "Integration Ingestion Title\n\nBody generated by integration test.",
      default_content_kind: "daily_current_affairs",
      default_category_node_id: categoryId,
      default_status: "draft"
    }
  });

  assert.equal(ingestionResponse.statusCode, 201);
  assert.equal(ingestionResponse.json().status, "parsed");
  assert.equal(ingestionResponse.json().items.length, 1);
});

test("admin can delete a category branch and keep linked articles as undefined category", async () => {
  const suffix = Date.now();
  const parentResponse = await server.inject({
    method: "POST",
    url: "/api/v1/current-affairs/categories",
    headers: auth(adminToken),
    payload: {
      content_family: "prelims",
      node_type: "subject",
      name: `Delete Parent ${suffix}`,
      slug: `delete-parent-${suffix}`
    }
  });
  assert.equal(parentResponse.statusCode, 201);
  const parentId = Number(parentResponse.json().id);

  const childResponse = await server.inject({
    method: "POST",
    url: "/api/v1/current-affairs/categories",
    headers: auth(adminToken),
    payload: {
      content_family: "prelims",
      parent_id: parentId,
      node_type: "topic",
      name: `Delete Child ${suffix}`,
      slug: `delete-child-${suffix}`
    }
  });
  assert.equal(childResponse.statusCode, 201);
  const childId = Number(childResponse.json().id);

  const articleSlug = `delete-branch-article-${suffix}`;
  const articleResponse = await server.inject({
    method: "POST",
    url: "/api/v1/current-affairs/articles",
    headers: auth(adminToken),
    payload: {
      content_kind: "daily_current_affairs",
      title: `Delete Branch Article ${suffix}`,
      slug: articleSlug,
      body: "This article should survive category deletion.",
      category_node_id: childId,
      publication_date: "2026-06-07",
      status: "published"
    }
  });
  assert.equal(articleResponse.statusCode, 201);

  const deleteResponse = await server.inject({
    method: "DELETE",
    url: `/api/v1/current-affairs/categories/${parentId}`,
    headers: auth(adminToken)
  });
  assert.equal(deleteResponse.statusCode, 200);

  const categoriesResponse = await server.inject({
    method: "GET",
    url: "/api/v1/current-affairs/categories?limit=1000",
    headers: auth(adminToken)
  });
  assert.equal(categoriesResponse.statusCode, 200);
  const remainingIds = new Set(categoriesResponse.json().map((item: { id: number }) => Number(item.id)));
  assert.equal(remainingIds.has(parentId), false);
  assert.equal(remainingIds.has(childId), false);

  const detailResponse = await server.inject({
    method: "GET",
    url: `/api/v1/current-affairs/articles/slug/${articleSlug}`
  });
  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailResponse.json().category_node_id, null);
  assert.equal(detailResponse.json().category, null);
});

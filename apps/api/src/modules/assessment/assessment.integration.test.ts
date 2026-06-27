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
let examId: number;
let levelId: number;
let subjectNodeId: number;
let questionVersionId: number;
let testTemplateId: number;
let attemptId: number;
let resultId: number;

async function createUser(role: AuthUser["role"], suffix: string): Promise<AuthUser> {
  const user = await one<AuthUser>(
    `
      insert into app.users (email, username, password_hash, role, is_active)
      values ($1, $2, 'test-only', $3, true)
      returning id, email, username, role, is_active
    `,
    [`assessment-${suffix}-${Date.now()}@example.test`, `assessment_${suffix}_${Date.now()}`, role]
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

test("admin can create a published objective test", async () => {
  const suffix = Date.now();

  const examResponse = await server.inject({
    method: "POST",
    url: "/api/v1/assessment/exams",
    headers: auth(adminToken),
    payload: {
      name: `Assessment Exam ${suffix}`,
      slug: `assessment-exam-${suffix}`
    }
  });
  assert.equal(examResponse.statusCode, 201);
  examId = Number(examResponse.json().id);

  const levelResponse = await server.inject({
    method: "POST",
    url: `/api/v1/assessment/exams/${examId}/levels`,
    headers: auth(adminToken),
    payload: {
      name: "Prelims",
      slug: `prelims-${suffix}`
    }
  });
  assert.equal(levelResponse.statusCode, 201);
  levelId = Number(levelResponse.json().id);

  const taxonomyResponse = await server.inject({
    method: "POST",
    url: "/api/v1/assessment/taxonomy-nodes",
    headers: auth(adminToken),
    payload: {
      exam_id: examId,
      node_type: "subject",
      name: "Polity",
      slug: `polity-${suffix}`
    }
  });
  assert.equal(taxonomyResponse.statusCode, 201);
  subjectNodeId = Number(taxonomyResponse.json().id);

  const formatResponse = await server.inject({
    method: "GET",
    url: "/api/v1/assessment/question-formats?question_family=objective&limit=10"
  });
  assert.equal(formatResponse.statusCode, 200);
  const format = formatResponse.json().find((item: { slug: string }) => item.slug === "standard_quiz");
  assert.ok(format);

  const questionResponse = await server.inject({
    method: "POST",
    url: "/api/v1/assessment/questions",
    headers: auth(adminToken),
    payload: {
      question_family: "objective",
      question_format_id: Number(format.id),
      status: "published",
      version: {
        question_statement: "Which option is correct?",
        question_prompt: "Choose one.",
        options: [
          { key: "A", text: "Correct option" },
          { key: "B", text: "Wrong option" }
        ],
        correct_answer: "A",
        explanation: "A is the configured correct answer."
      },
      taxonomy: {
        exam_id: examId,
        exam_level_id: levelId,
        subject_node_id: subjectNodeId
      }
    }
  });
  assert.equal(questionResponse.statusCode, 201);
  questionVersionId = Number(questionResponse.json().current_version.id);

  const testResponse = await server.inject({
    method: "POST",
    url: "/api/v1/assessment/test-templates",
    headers: auth(adminToken),
    payload: {
      title: `Assessment Test ${suffix}`,
      slug: `assessment-test-${suffix}`,
      exam_id: examId,
      exam_level_id: levelId,
      test_type: "quick_test",
      duration_minutes: 10,
      total_marks: 2,
      access_type: "free",
      status: "published"
    }
  });
  assert.equal(testResponse.statusCode, 201);
  testTemplateId = Number(testResponse.json().id);

  const sectionResponse = await server.inject({
    method: "POST",
    url: `/api/v1/assessment/test-templates/${testTemplateId}/sections`,
    headers: auth(adminToken),
    payload: {
      title: "General",
      display_order: 1
    }
  });
  assert.equal(sectionResponse.statusCode, 201);

  const itemResponse = await server.inject({
    method: "POST",
    url: `/api/v1/assessment/test-templates/${testTemplateId}/questions`,
    headers: auth(adminToken),
    payload: {
      test_section_id: Number(sectionResponse.json().id),
      question_version_id: questionVersionId,
      marks: 2,
      negative_marks: 0.66,
      display_order: 1
    }
  });
  assert.equal(itemResponse.statusCode, 201);
});

test("student can load sanitized paper, attempt, submit, and review", async () => {
  const paperResponse = await server.inject({
    method: "GET",
    url: `/api/v1/assessment/test-templates/${testTemplateId}/paper`
  });
  assert.equal(paperResponse.statusCode, 200);
  assert.equal(paperResponse.json().questions.length, 1);
  assert.equal(paperResponse.json().questions[0].question_version.correct_answer, undefined);

  const startResponse = await server.inject({
    method: "POST",
    url: `/api/v1/assessment/test-templates/${testTemplateId}/attempts/start`,
    headers: auth(studentToken),
    payload: {}
  });
  assert.equal(startResponse.statusCode, 201);
  attemptId = Number(startResponse.json().id);

  const attemptPaperResponse = await server.inject({
    method: "GET",
    url: `/api/v1/assessment/attempts/${attemptId}/paper`,
    headers: auth(studentToken)
  });
  assert.equal(attemptPaperResponse.statusCode, 200);
  assert.equal(attemptPaperResponse.json().questions.length, 1);
  assert.equal(attemptPaperResponse.json().questions[0].question_version.correct_answer, undefined);

  const response = await server.inject({
    method: "PUT",
    url: `/api/v1/assessment/attempts/${attemptId}/responses`,
    headers: auth(studentToken),
    payload: {
      question_version_id: questionVersionId,
      selected_answer: "A",
      status: "answered",
      time_spent_seconds: 25
    }
  });
  assert.equal(response.statusCode, 200);

  const submitResponse = await server.inject({
    method: "POST",
    url: `/api/v1/assessment/attempts/${attemptId}/submit`,
    headers: auth(studentToken),
    payload: {
      submit_idempotency_key: `assessment-submit-${Date.now()}`,
      time_spent_seconds: 25
    }
  });
  assert.equal(submitResponse.statusCode, 200);
  resultId = Number(submitResponse.json().id);
  assert.equal(Number(submitResponse.json().score), 2);

  const reviewResponse = await server.inject({
    method: "GET",
    url: `/api/v1/assessment/results/${resultId}/review`,
    headers: auth(studentToken)
  });
  assert.equal(reviewResponse.statusCode, 200);
  assert.equal(reviewResponse.json().questions.length, 1);
  assert.equal(reviewResponse.json().questions[0].question_version.correct_answer, "A");

  const attemptsResponse = await server.inject({
    method: "GET",
    url: "/api/v1/assessment/me/attempts?limit=10",
    headers: auth(studentToken)
  });
  assert.equal(attemptsResponse.statusCode, 200);
  assert.ok(attemptsResponse.json().some((item: { id: number }) => Number(item.id) === attemptId));
});

test("admin can delete an exam with linked categories and test history", async () => {
  const deleteResponse = await server.inject({
    method: "DELETE",
    url: `/api/v1/assessment/exams/${examId}`,
    headers: auth(adminToken)
  });
  assert.equal(deleteResponse.statusCode, 200);

  const exam = await one<{ id: string }>("select id::text as id from assessment.exams where id = $1", [examId]);
  assert.equal(exam, null);

  const template = await one<{ id: string }>(
    "select id::text as id from assessment.test_templates where id = $1",
    [testTemplateId]
  );
  assert.equal(template, null);

  const attempt = await one<{ id: string }>(
    "select id::text as id from assessment.test_attempts where id = $1",
    [attemptId]
  );
  assert.equal(attempt, null);

  const objectiveNodes = await one<{ count: string }>(
    "select count(*)::text as count from assessment.assessment_taxonomy_nodes where exam_id = $1",
    [examId]
  );
  assert.equal(Number(objectiveNodes?.count ?? 0), 0);

  const objectiveLinks = await one<{ count: string }>(
    "select count(*)::text as count from assessment.question_taxonomy_links where exam_id = $1",
    [examId]
  );
  assert.equal(Number(objectiveLinks?.count ?? 0), 0);

  const question = await one<{ id: string }>(
    `
      select q.id::text as id
      from assessment.questions q
      join assessment.question_versions qv on qv.question_id = q.id
      where qv.id = $1
    `,
    [questionVersionId]
  );
  assert.ok(question);
});

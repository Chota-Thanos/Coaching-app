import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../server.js";
import { closePool, one, query } from "../../db.js";
import { signAccessToken } from "../auth/service.js";
import type { AuthUser } from "../auth/schemas.js";

let server: FastifyInstance;
let mentorToken: string;
let studentToken: string;
let adminToken: string;
let mentorUser: AuthUser;
let studentUser: AuthUser;
let adminUser: AuthUser;

async function createUser(role: AuthUser["role"], suffix: string): Promise<AuthUser> {
  const user = await one<AuthUser>(
    `
      insert into app.users (email, username, password_hash, role, is_active)
      values ($1, $2, 'test-only', $3, true)
      returning id, email, username, role, is_active
    `,
    [`mentorship-${suffix}-${Date.now()}@example.test`, `mentor_${suffix}_${Date.now()}`, role]
  );
  assert.ok(user);
  return user;
}

async function createMentorProfile(userId: number, displayName: string) {
  return one(
    `
      insert into app.mentor_profiles (user_id, display_name, headline, bio, years_experience, city)
      values ($1, $2, 'Ethics Expert', 'Guide for aspirants', 5, 'Delhi')
      returning *
    `,
    [userId, displayName]
  );
}

function auth(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

before(async () => {
  server = await buildServer();
  mentorUser = await createUser("mentor", "mentor");
  studentUser = await createUser("student", "student");
  adminUser = await createUser("admin", "admin");
  mentorToken = signAccessToken(mentorUser);
  studentToken = signAccessToken(studentUser);
  adminToken = signAccessToken(adminUser);

  await createMentorProfile(mentorUser.id, "Dr. Ethics");
});

after(async () => {
  await server.close();
  await closePool();
});

test("mentorship request triggers a notification for the mentor, which can be retrieved and read", async () => {
  // Clear any existing notifications
  await query("delete from app.notifications where user_id = $1", [mentorUser.id]);

  // 1. Submit a request as student
  const requestResponse = await server.inject({
    method: "POST",
    url: "/api/v1/mentorship/requests",
    headers: auth(studentToken),
    payload: {
      mentor_id: mentorUser.id,
      preferred_mode: "video",
      note: "Need GS4 Essay tips"
    }
  });

  assert.equal(requestResponse.statusCode, 201);
  const requestJson = requestResponse.json();
  const requestId = requestJson.id;
  assert.ok(requestId);

  // 2. Fetch notifications as the mentor
  const fetchResponse = await server.inject({
    method: "GET",
    url: "/api/v1/notifications?limit=10",
    headers: auth(mentorToken)
  });

  assert.equal(fetchResponse.statusCode, 200);
  const notifications = fetchResponse.json();
  assert.ok(Array.isArray(notifications));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "new_request");
  assert.equal(notifications[0].is_read, false);
  assert.ok(notifications[0].message.includes(studentUser.username));

  const notificationId = notifications[0].id;

  // 3. Mark notification as read
  const readResponse = await server.inject({
    method: "PUT",
    url: `/api/v1/notifications/${notificationId}/read`,
    headers: auth(mentorToken)
  });

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json().is_read, true);

  // 4. Fetch notifications again and confirm read state
  const fetchAgainResponse = await server.inject({
    method: "GET",
    url: "/api/v1/notifications?limit=10",
    headers: auth(mentorToken)
  });
  assert.equal(fetchAgainResponse.json()[0].is_read, true);
});

test("mark-all-read endpoint marks all unread notifications for a user", async () => {
  // 1. Manually insert some unread notifications
  await query("delete from app.notifications where user_id = $1", [mentorUser.id]);
  await query(
    `insert into app.notifications (user_id, type, title, message)
     values ($1, 'chat_message', 'New chat', 'Hello'),
            ($1, 'chat_message', 'Another chat', 'Hi')`,
    [mentorUser.id]
  );

  // Verify they are unread
  const beforeRead = await query("select * from app.notifications where user_id = $1 and is_read = false", [mentorUser.id]);
  assert.equal(beforeRead.length, 2);

  // 2. Mark all as read
  const markAllResponse = await server.inject({
    method: "PUT",
    url: "/api/v1/notifications/mark-all-read",
    headers: auth(mentorToken)
  });

  assert.equal(markAllResponse.statusCode, 200);

  // Verify they are now read
  const afterRead = await query("select * from app.notifications where user_id = $1 and is_read = false", [mentorUser.id]);
  assert.equal(afterRead.length, 0);
});

test("mentorship requests agendas lifecycle, payment and completion lock", async () => {
  // 1. Submit a request as student
  const requestResponse = await server.inject({
    method: "POST",
    url: "/api/v1/mentorship/requests",
    headers: auth(studentToken),
    payload: {
      mentor_id: mentorUser.id,
      preferred_mode: "video",
      note: "Agenda integration testing request"
    }
  });

  assert.equal(requestResponse.statusCode, 201);
  const requestJson = requestResponse.json();
  const requestId = requestJson.id;

  // 2. Propose an agenda as student
  const agendaResponse = await server.inject({
    method: "POST",
    url: `/api/v1/mentorship/requests/${requestId}/agendas`,
    headers: auth(studentToken),
    payload: {
      title: "Solve GS Mains Essay doubt",
      description: "Needs detailed evaluation of structural writing style"
    }
  });

  assert.equal(agendaResponse.statusCode, 201);
  const agendaJson = agendaResponse.json();
  const agendaId = agendaJson.id;
  assert.equal(agendaJson.status, "proposed");

  // 3. Proposing a second agenda as mentor
  const agenda2Response = await server.inject({
    method: "POST",
    url: `/api/v1/mentorship/requests/${requestId}/agendas`,
    headers: auth(mentorToken),
    payload: {
      title: "Review GS paper structure",
      description: "Brief review of key paper layout ideas"
    }
  });
  assert.equal(agenda2Response.statusCode, 201);
  const agenda2Id = agenda2Response.json().id;

  // 4. Try to pay (should fail because both agendas are 'proposed' and not agreed)
  const failPayResponse = await server.inject({
    method: "POST",
    url: `/api/v1/mentorship/requests/${requestId}/pay`,
    headers: auth(studentToken)
  });
  assert.equal(failPayResponse.statusCode, 400);

  // 5. Agree to agenda 1 (agreed by mentor, since proposed by student)
  const agree1Response = await server.inject({
    method: "PUT",
    url: `/api/v1/mentorship/agendas/${agendaId}/agree`,
    headers: auth(mentorToken)
  });
  assert.equal(agree1Response.statusCode, 200);
  assert.equal(agree1Response.json().status, "agreed");

  // 6. Try to pay again (should still fail because agenda 2 is still proposed)
  const failPay2Response = await server.inject({
    method: "POST",
    url: `/api/v1/mentorship/requests/${requestId}/pay`,
    headers: auth(studentToken)
  });
  assert.equal(failPay2Response.statusCode, 400);

  // 7. Agree to agenda 2 (agreed by student, since proposed by mentor)
  const agree2Response = await server.inject({
    method: "PUT",
    url: `/api/v1/mentorship/agendas/${agenda2Id}/agree`,
    headers: auth(studentToken)
  });
  assert.equal(agree2Response.statusCode, 200);

  // 8. Now payment should succeed
  const payResponse = await server.inject({
    method: "POST",
    url: `/api/v1/mentorship/requests/${requestId}/pay`,
    headers: auth(studentToken)
  });
  assert.equal(payResponse.statusCode, 200);
  assert.equal(payResponse.json().payment_status, "paid");

  // 9. Try to mark request as completed (should fail because agendas are agreed but not solved)
  const failCompleteResponse = await server.inject({
    method: "PUT",
    url: `/api/v1/mentorship/requests/${requestId}/status`,
    headers: auth(mentorToken),
    payload: {
      status: "completed"
    }
  });
  assert.equal(failCompleteResponse.statusCode, 400);

  // 10. Propose solve agenda 1 as mentor
  const solvePropose1Response = await server.inject({
    method: "PUT",
    url: `/api/v1/mentorship/agendas/${agendaId}/solve-propose`,
    headers: auth(mentorToken)
  });
  assert.equal(solvePropose1Response.statusCode, 200);
  assert.equal(solvePropose1Response.json().status, "solved_proposed");

  // 11. Propose solve agenda 2 as mentor
  const solvePropose2Response = await server.inject({
    method: "PUT",
    url: `/api/v1/mentorship/agendas/${agenda2Id}/solve-propose`,
    headers: auth(mentorToken)
  });
  assert.equal(solvePropose2Response.statusCode, 200);

  // 12. Confirm solve agenda 1 as student (consent given)
  const solveConfirm1Response = await server.inject({
    method: "PUT",
    url: `/api/v1/mentorship/agendas/${agendaId}/solve-confirm`,
    headers: auth(studentToken)
  });
  assert.equal(solveConfirm1Response.statusCode, 200);
  assert.equal(solveConfirm1Response.json().status, "solved");

  // 13. Try to complete request (should still fail because agenda 2 is solved_proposed, not solved)
  const failComplete2Response = await server.inject({
    method: "PUT",
    url: `/api/v1/mentorship/requests/${requestId}/status`,
    headers: auth(mentorToken),
    payload: {
      status: "completed"
    }
  });
  assert.equal(failComplete2Response.statusCode, 400);

  // 14. Confirm solve agenda 2 as student
  const solveConfirm2Response = await server.inject({
    method: "PUT",
    url: `/api/v1/mentorship/agendas/${agenda2Id}/solve-confirm`,
    headers: auth(studentToken)
  });
  assert.equal(solveConfirm2Response.statusCode, 200);

  // 15. Now complete request should succeed
  const completeResponse = await server.inject({
    method: "PUT",
    url: `/api/v1/mentorship/requests/${requestId}/status`,
    headers: auth(mentorToken),
    payload: {
      status: "completed"
    }
  });
  assert.equal(completeResponse.statusCode, 200);
  assert.equal(completeResponse.json().status, "completed");
});

test("mentorship settings can be retrieved by anyone and updated by admin", async () => {
  // 1. Get settings (Public)
  const getRes = await server.inject({
    method: "GET",
    url: "/api/v1/mentorship/settings"
  });
  assert.equal(getRes.statusCode, 200);
  const settings = getRes.json();
  assert.ok(Array.isArray(settings.target_exams));
  assert.ok(Array.isArray(settings.approved_specifications));

  // 2. Attempt to update settings as student (should fail with 403 Forbidden)
  const failPutRes = await server.inject({
    method: "PUT",
    url: "/api/v1/admin/mentorship/settings",
    headers: auth(studentToken),
    payload: {
      key: "target_exams",
      value: ["UPSC CSE", "UPPSC", "BPSC", "MPSC", "GPSC"]
    }
  });
  assert.equal(failPutRes.statusCode, 403);

  // 3. Update settings as admin (should succeed)
  const putRes = await server.inject({
    method: "PUT",
    url: "/api/v1/admin/mentorship/settings",
    headers: auth(adminToken),
    payload: {
      key: "target_exams",
      value: ["UPSC CSE", "UPPSC", "BPSC", "MPSC", "GPSC"]
    }
  });
  assert.equal(putRes.statusCode, 200);
  assert.equal(putRes.json().key, "target_exams");

  // 4. Retrieve settings again to verify changes
  const getAgainRes = await server.inject({
    method: "GET",
    url: "/api/v1/mentorship/settings"
  });
  assert.equal(getAgainRes.statusCode, 200);
  assert.deepEqual(getAgainRes.json().target_exams, ["UPSC CSE", "UPPSC", "BPSC", "MPSC", "GPSC"]);
});

test("mentorship profile question PDFs, custom student copy, and agenda attachments", async () => {
  // Create a fresh student user to prevent using previous paid requests from sharing state
  const freshStudentUser = await createUser("student", "fresh_student");
  const freshStudentToken = signAccessToken(freshStudentUser);

  // 1. Submit a request with a custom student copy
  const requestResponse = await server.inject({
    method: "POST",
    url: "/api/v1/mentorship/requests",
    headers: auth(freshStudentToken),
    payload: {
      mentor_id: mentorUser.id,
      preferred_mode: "video",
      note: "Need evaluation on custom copy",
      student_copy: {
        url: "https://example.com/student_copy.pdf",
        file_name: "custom_essay.pdf"
      }
    }
  });

  assert.equal(requestResponse.statusCode, 201);
  const requestJson = requestResponse.json();
  const requestId = requestJson.id;
  assert.ok(requestId);
  assert.deepEqual(requestJson.meta.student_copy, {
    url: "https://example.com/student_copy.pdf",
    file_name: "custom_essay.pdf"
  });

  // 2. Update mentor profile settings: own questions & uploaded question PDFs
  const updateRes = await server.inject({
    method: "PUT",
    url: "/api/v1/mentorship/profile",
    headers: auth(mentorToken),
    payload: {
      display_name: "Dr. Ethics",
      evaluation_source: "own_questions",
      question_pdfs: [
        {
          file_name: "Mock Question Set A.pdf",
          url: "https://example.com/qset_a.pdf"
        }
      ]
    }
  });
  assert.equal(updateRes.statusCode, 200);

  // 3. Fetch mentor profile as guest (unauthenticated) - URLs should be locked
  const guestRes = await server.inject({
    method: "GET",
    url: `/api/v1/mentorship/profiles/${mentorUser.id}`
  });
  assert.equal(guestRes.statusCode, 200);
  const guestProfile = guestRes.json();
  assert.equal(guestProfile.meta.question_pdfs[0].url, null);
  assert.equal(guestProfile.meta.question_pdfs[0].locked, true);

  // 4. Fetch mentor profile as student before payment/acceptance - URLs should be locked
  const unpaidRes = await server.inject({
    method: "GET",
    url: `/api/v1/mentorship/profiles/${mentorUser.id}`,
    headers: auth(freshStudentToken)
  });
  assert.equal(unpaidRes.statusCode, 200);
  const unpaidProfile = unpaidRes.json();
  assert.equal(unpaidProfile.meta.question_pdfs[0].url, null);
  assert.equal(unpaidProfile.meta.question_pdfs[0].locked, true);

  // 5. Create an agenda with an attached question PDF
  const agendaRes = await server.inject({
    method: "POST",
    url: `/api/v1/mentorship/requests/${requestId}/agendas`,
    headers: auth(mentorToken),
    payload: {
      title: "Solve custom mock question",
      description: "Use the attached question for reference",
      attached_question: {
        file_name: "Mock Question Set A.pdf",
        url: "https://example.com/qset_a.pdf"
      }
    }
  });
  assert.equal(agendaRes.statusCode, 201);
  const agendaJson = agendaRes.json();
  assert.deepEqual(agendaJson.meta.attached_question, {
    file_name: "Mock Question Set A.pdf",
    url: "https://example.com/qset_a.pdf"
  });

  // 6. Complete agreement and payment to unlock profile question URLs
  // Agree to the proposed agenda (agreed by student since proposed by mentor)
  const agreeRes = await server.inject({
    method: "PUT",
    url: `/api/v1/mentorship/agendas/${agendaJson.id}/agree`,
    headers: auth(freshStudentToken)
  });
  assert.equal(agreeRes.statusCode, 200);

  // Pay the request
  const payRes = await server.inject({
    method: "POST",
    url: `/api/v1/mentorship/requests/${requestId}/pay`,
    headers: auth(freshStudentToken)
  });
  assert.equal(payRes.statusCode, 200);

  // 7. Fetch mentor profile as student after payment - URLs should be unlocked!
  const paidRes = await server.inject({
    method: "GET",
    url: `/api/v1/mentorship/profiles/${mentorUser.id}`,
    headers: auth(freshStudentToken)
  });
  assert.equal(paidRes.statusCode, 200);
  const paidProfile = paidRes.json();
  assert.equal(paidProfile.meta.question_pdfs[0].url, "https://example.com/qset_a.pdf");
  assert.equal(paidProfile.meta.question_pdfs[0].locked, undefined);

  // 8. Fetch mentor profile as mentor - URLs should be unlocked
  const mentorProfileRes = await server.inject({
    method: "GET",
    url: `/api/v1/mentorship/profiles/${mentorUser.id}`,
    headers: auth(mentorToken)
  });
  assert.equal(mentorProfileRes.statusCode, 200);
  const mentorProfile = mentorProfileRes.json();
  assert.equal(mentorProfile.meta.question_pdfs[0].url, "https://example.com/qset_a.pdf");
  assert.equal(mentorProfile.meta.question_pdfs[0].locked, undefined);
});




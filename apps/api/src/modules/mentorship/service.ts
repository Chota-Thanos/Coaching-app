import crypto from "node:crypto";
import { config } from "../../config.js";
import { one, query, transaction, type DbClient } from "../../db.js";
import { generateAgoraRtcToken } from "../../common/agora.js";
import type {
  CreateOnboardingApplicationInput,
  DraftOnboardingApplicationInput,
  ReviewOnboardingApplicationInput,
  CreateMentorshipSlotInput,
  ListMentorshipSlotsQuery,
  CreateMentorshipRequestInput,
  UpdateMentorProfileInput,
  UpdateMentorshipSettingInput,
  CreateAgendaInput,
  SubmitCustomCopyEvaluationInput,
  VerifyMentorshipPaymentInput
} from "./schemas.js";

// --- Onboarding Logic ---

export async function saveOnboardingDraft(userId: number, payload: DraftOnboardingApplicationInput, email: string) {
  const existing = await one<{ id: number }>(
    `select id from app.professional_onboarding_requests
     where user_id = $1 and status = 'draft'
     order by updated_at desc limit 1`,
    [userId]
  );

  const full_name = payload.full_name || email.split("@")[0] || "Draft User";
  const details = payload.details || {};

  if (existing) {
    return one(
      `update app.professional_onboarding_requests
       set full_name = $1, city = $2, years_experience = $3, phone = $4, about = $5, details = $6, updated_at = now()
       where id = $7
       returning *`,
      [
        full_name,
        payload.city || null,
        payload.years_experience ?? null,
        payload.phone || "",
        payload.about || "",
        JSON.stringify(details),
        existing.id
      ]
    );
  } else {
    return one(
      `insert into app.professional_onboarding_requests
       (user_id, email_snapshot, desired_role, full_name, city, years_experience, phone, about, status, details)
       values ($1, $2, 'mentor', $3, $4, $5, $6, $7, 'draft', $8)
       returning *`,
      [
        userId,
        email,
        full_name,
        payload.city || null,
        payload.years_experience ?? null,
        payload.phone || "",
        payload.about || "",
        JSON.stringify(details)
      ]
    );
  }
}

export async function submitOnboarding(userId: number, payload: CreateOnboardingApplicationInput, email: string) {
  return transaction(async (client) => {
    // Check if there is already a pending request
    const pending = await one(
      `select id from app.professional_onboarding_requests
       where user_id = $1 and status = 'pending'
       limit 1`,
      [userId],
      client
    );

    if (pending) {
      throw new Error("You already have a pending onboarding request under review.");
    }

    // Check if user is already a mentor
    const userRole = await one<{ role: string }>(
      `select role from app.users where id = $1`,
      [userId],
      client
    );
    if (userRole?.role === "mentor") {
      throw new Error("You are already approved as a mentor.");
    }

    // Clean up draft, rejected, or more_info_required if it exists
    await client.query(
      `delete from app.professional_onboarding_requests
       where user_id = $1 and status in ('draft', 'rejected', 'more_info_required')`,
      [userId]
    );

    return one(
      `insert into app.professional_onboarding_requests
       (user_id, email_snapshot, desired_role, full_name, city, years_experience, phone, about, status, details)
       values ($1, $2, 'mentor', $3, $4, $5, $6, $7, 'pending', $8)
       returning *`,
      [
        userId,
        email,
        payload.full_name,
        payload.city || null,
        payload.years_experience ?? null,
        payload.phone,
        payload.about || "",
        JSON.stringify(payload.details)
      ],
      client
    );
  });
}

export async function listMyOnboardings(userId: number, limit = 20) {
  return query(
    `select * from app.professional_onboarding_requests
     where user_id = $1
     order by updated_at desc, created_at desc
     limit $2`,
    [userId, limit]
  );
}

export async function listAllOnboardings(status: string, limit = 200) {
  let sql = `select * from app.professional_onboarding_requests`;
  const params: unknown[] = [];

  if (status !== "all") {
    sql += ` where status = $1`;
    params.push(status);
  }

  sql += ` order by updated_at desc, created_at desc limit $${params.length + 1}`;
  params.push(limit);

  return query(sql, params);
}

export async function reviewOnboarding(applicationId: number, reviewerId: number, payload: ReviewOnboardingApplicationInput) {
  return transaction(async (client) => {
    const application = await one<any>(
      `select * from app.professional_onboarding_requests
       where id = $1
       limit 1`,
      [applicationId],
      client
    );

    if (!application) {
      throw new Error("Onboarding application not found.");
    }

    if (application.status !== "pending") {
      throw new Error("Only pending onboarding applications can be reviewed.");
    }

    let nextStatus: string;
    if (payload.action === "approve") {
      nextStatus = "approved";
    } else if (payload.action === "reject") {
      nextStatus = "rejected";
    } else {
      nextStatus = "more_info_required";
    }

    const updated = await one<any>(
      `update app.professional_onboarding_requests
       set status = $1, reviewer_user_id = $2, reviewer_note = $3, specifications = $4, reviewed_at = now(), updated_at = now()
       where id = $5
       returning *`,
      [nextStatus, reviewerId, payload.reviewer_note || null, payload.specifications || [], applicationId],
      client
    );

    if (payload.action === "approve") {
      // 1. Update user role
      await client.query(
        `update app.users set role = 'mentor' where id = $1`,
        [application.user_id]
      );

      // 2. Build profile structures
      const details = application.details || {};
      const meta = {
        onboarding_source: "professional_onboarding",
        onboarding_approved_at: new Date().toISOString(),
        phone: application.phone,
        eligibility_details: details
      };

      const highlights = [
        details.current_occupation || "Expert Mentor",
        details.mains_written_count !== null && details.mains_written_count !== undefined
          ? `Mains Written: ${details.mains_written_count}`
          : null,
        details.interview_faced_count !== null && details.interview_faced_count !== undefined
          ? `Interviews Faced: ${details.interview_faced_count}`
          : null,
        details.mentorship_years !== null && details.mentorship_years !== undefined
          ? `Mentorship: ${details.mentorship_years} years`
          : null
      ].filter(Boolean) as string[];

      const specializationTags = [
        details.optional_subject,
        ...(details.gs_preferences || [])
      ].filter(Boolean) as string[];

      const credentials = [
        "Official UPSC Credentials Reviewed",
        details.sample_evaluation ? "Sample Evaluated Copy Reviewed" : null
      ].filter(Boolean) as string[];

      await client.query(
        `insert into app.mentor_profiles (
          user_id, display_name, headline, bio, years_experience, city,
          profile_image_url, contact_url, public_email, specialization_tags, highlights, credentials, meta, specifications
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        on conflict (user_id) do update set
          display_name = excluded.display_name,
          headline = excluded.headline,
          bio = excluded.bio,
          years_experience = excluded.years_experience,
          city = excluded.city,
          profile_image_url = excluded.profile_image_url,
          contact_url = excluded.contact_url,
          public_email = excluded.public_email,
          specialization_tags = excluded.specialization_tags,
          highlights = excluded.highlights,
          credentials = excluded.credentials,
          meta = excluded.meta,
          specifications = excluded.specifications,
          updated_at = now()`,
        [
          application.user_id,
          application.full_name,
          details.current_occupation || "Expert UPSC Mentor",
          application.about || "UPSC Mentor and Exam Expert",
          application.years_experience || details.mentorship_years || 0,
          application.city || null,
          details.professional_headshot?.url || null,
          application.phone ? `tel:${application.phone}` : null,
          application.email_snapshot,
          specializationTags,
          highlights,
          credentials,
          JSON.stringify(meta),
          payload.specifications || []
        ]
      );
    }

    return updated;
  });
}

// --- Mentor Profile Directory ---

export async function listMentorProfiles() {
  return query(
    `select mp.*, u.email, u.username
     from app.mentor_profiles mp
     join app.users u on u.id = mp.user_id
     where mp.is_active = true and mp.is_public = true
     order by mp.years_experience desc, mp.created_at desc`
  );
}

export async function getMentorProfile(mentorId: number) {
  return one(
    `select mp.*, u.email, u.username
     from app.mentor_profiles mp
     join app.users u on u.id = mp.user_id
     where mp.user_id = $1`,
    [mentorId]
  );
}

// --- Slots Management ---

export async function createSlots(mentorId: number, slots: CreateMentorshipSlotInput[]) {
  return transaction(async (client) => {
    const created: any[] = [];
    for (const slot of slots) {
      const record = await one(
        `insert into app.mentorship_slots
         (mentor_id, starts_at, ends_at, mode, max_bookings, meeting_link, title, description)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning *`,
        [
          mentorId,
          slot.starts_at,
          slot.ends_at,
          slot.mode,
          slot.max_bookings,
          slot.meeting_link || null,
          slot.title || "1-on-1 Mentorship Call",
          slot.description || ""
        ],
        client
      );
      created.push(record);
    }
    return created;
  });
}

export async function listSlots(filter: ListMentorshipSlotsQuery) {
  let sql = `select * from app.mentorship_slots where 1=1`;
  const params: unknown[] = [];

  if (filter.mentor_id) {
    params.push(filter.mentor_id);
    sql += ` and mentor_id = $${params.length}`;
  }

  if (filter.upcoming_only) {
    sql += ` and starts_at > now()`;
  }

  if (filter.active_only) {
    sql += ` and is_active = true and booked_count < max_bookings`;
  }

  sql += ` order by starts_at asc`;

  return query(sql, params);
}

export async function deactivateSlot(mentorId: number, slotId: number) {
  return one(
    `update app.mentorship_slots
     set is_active = false, updated_at = now()
     where id = $1 and mentor_id = $2
     returning *`,
    [slotId, mentorId]
  );
}

// --- Mentorship Requests ---

export async function createRequest(userId: number, payload: CreateMentorshipRequestInput) {
  // Check if learner attempts to request themselves
  if (userId === payload.mentor_id) {
    throw new Error("You cannot request a mentorship session with yourself.");
  }

  // Check if mentor exists
  const mentor = await getMentorProfile(payload.mentor_id);
  if (!mentor) {
    throw new Error("Selected mentor profile does not exist.");
  }

  // A student may only link their own submitted Mains answer -- otherwise anyone
  // could attach another student's attempt id to their own mentorship request.
  if (payload.mains_answer_attempt_id) {
    const attempt = await one<{ user_id: number }>(
      `select user_id from assessment.mains_answer_attempts where id = $1`,
      [payload.mains_answer_attempt_id]
    );
    if (!attempt || Number(attempt.user_id) !== Number(userId)) {
      throw new Error("Selected Mains answer copy does not belong to you.");
    }
  }

  const meta = {
    student_copy: payload.student_copy || null
  };

  const request = await one<any>(
    `insert into app.mentorship_requests
     (user_id, mentor_id, mains_answer_attempt_id, preferred_mode, note, status, payment_status, payment_amount, meta)
     values ($1, $2, $3, $4, $5, 'requested', 'pending', 1000, $6)
     returning *`,
    [
      userId,
      payload.mentor_id,
      payload.mains_answer_attempt_id || null,
      payload.preferred_mode,
      payload.note || "",
      JSON.stringify(meta)
    ]
  );

  if (request) {
    const learner = await one<{ username: string }>(
      `select username from app.users where id = $1`,
      [userId]
    );
    const learnerName = learner?.username || "A student";

    await createNotification(
      payload.mentor_id,
      "new_request",
      "New Student Request",
      `${learnerName} has requested a 1-on-1 mentorship session.`,
      "/mentor/workspace?tab=requests"
    );
  }

  return request;
}

/** Evaluation path for requests where the student attached a directly-uploaded
 * answer copy (meta.student_copy) instead of linking a platform mains_answer_attempts
 * row. Stored under meta.evaluation since there is no attempt row to attach it to. */
export async function submitCustomCopyEvaluation(
  requestId: number,
  mentorId: number,
  userRole: string,
  payload: SubmitCustomCopyEvaluationInput
) {
  return transaction(async (client) => {
    const request = await one<any>(
      `select * from app.mentorship_requests where id = $1`,
      [requestId],
      client
    );

    if (!request) {
      throw new Error("Mentorship request not found.");
    }

    if (Number(request.mentor_id) !== mentorId && !["admin", "moderator"].includes(userRole)) {
      throw new Error("Only the mentor assigned to this request can submit its evaluation.");
    }

    if (request.mains_answer_attempt_id) {
      throw new Error("This request is linked to a platform Mains attempt -- submit its evaluation via the Mains evaluation endpoint instead.");
    }

    if (!request.meta?.student_copy) {
      throw new Error("This request has no attached answer copy to evaluate.");
    }

    const evaluation = {
      score: payload.score,
      max_score: payload.max_score,
      feedback: payload.feedback || null,
      checked_copy_url: payload.checked_copy_url || null,
      checked_copy_file_name: payload.checked_copy_file_name || null,
      strengths: payload.strengths || [],
      weaknesses: payload.weaknesses || [],
      evaluated_by_user_id: mentorId,
      evaluated_at: new Date().toISOString()
    };

    const updated = await one<any>(
      `update app.mentorship_requests
       set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('evaluation', $1::jsonb),
           updated_at = now()
       where id = $2
       returning *`,
      [JSON.stringify(evaluation), requestId],
      client
    );

    await createNotification(
      request.user_id,
      "evaluation_submitted",
      "Your Copy Has Been Evaluated",
      "Your mentor has finished evaluating your answer copy. View your score, feedback and checked copy now.",
      "/dashboard/mentorship",
      client
    );

    return updated;
  });
}

export async function listRequests(userId: number, userRole: string, mode: "user" | "provider") {
  let sql = `
    select r.*, 
           lm.full_name as learner_name,
           lm.email_snapshot as learner_email,
           mp.display_name as mentor_name,
           mp.profile_image_url as mentor_headshot,
           mp.meta as mentor_meta,
           u_m.email as mentor_email,
           s.id as session_id,
           s.starts_at as session_starts_at,
           s.ends_at as session_ends_at,
           s.meeting_link as session_meeting_link,
           s.status as session_status,
           maa.evaluation_status,
           maa.score as evaluation_score,
           maa.max_score as evaluation_max_score,
           maa.feedback as evaluation_feedback,
           maa.checked_copy_url as evaluation_checked_copy_url,
           maa.strengths as evaluation_strengths,
           maa.weaknesses as evaluation_weaknesses,
           maa.answer_file_url as attempt_answer_file_url,
           maa.student_answer_text as attempt_student_answer_text,
           qv.question_statement as attempt_question_statement
    from app.mentorship_requests r
    left join app.professional_onboarding_requests lm on lm.user_id = r.user_id and lm.status = 'approved'
    left join app.mentor_profiles mp on mp.user_id = r.mentor_id
    left join app.users u_m on u_m.id = r.mentor_id
    left join app.mentorship_sessions s on s.request_id = r.id
    left join assessment.mains_answer_attempts maa on maa.id = r.mains_answer_attempt_id
    left join assessment.question_versions qv on qv.id = maa.question_version_id
    where 1=1
  `;
  const params: unknown[] = [];

  if (mode === "provider") {
    // If provider capable, show requests targeted to them as mentor
    params.push(userId);
    sql += ` and r.mentor_id = $${params.length}`;
  } else {
    // Learner view
    params.push(userId);
    sql += ` and r.user_id = $${params.length}`;
  }

  sql += ` order by r.updated_at desc, r.created_at desc`;
  return query(sql, params);
}

/** Admin/moderator oversight view across every in-flight mentorship engagement --
 * unlike listRequests, this is not scoped to a single learner or mentor. */
export async function listAllRequestsForAdmin(filter: { status?: string; payment_status?: string; limit?: number }) {
  let sql = `
    select r.*,
           lm.full_name as learner_name,
           u_l.username as learner_username,
           u_l.email as learner_email,
           mp.display_name as mentor_name,
           u_m.username as mentor_username,
           u_m.email as mentor_email,
           s.id as session_id,
           s.starts_at as session_starts_at,
           s.ends_at as session_ends_at,
           s.status as session_status,
           maa.evaluation_status,
           maa.score as evaluation_score,
           maa.max_score as evaluation_max_score,
           (select count(*)::int from app.mentorship_agendas a where a.request_id = r.id) as agenda_count,
           (select count(*)::int from app.mentorship_agendas a where a.request_id = r.id and a.status != 'solved') as agenda_open_count
    from app.mentorship_requests r
    left join app.professional_onboarding_requests lm on lm.user_id = r.user_id and lm.status = 'approved'
    left join app.users u_l on u_l.id = r.user_id
    left join app.mentor_profiles mp on mp.user_id = r.mentor_id
    left join app.users u_m on u_m.id = r.mentor_id
    left join app.mentorship_sessions s on s.request_id = r.id
    left join assessment.mains_answer_attempts maa on maa.id = r.mains_answer_attempt_id
    where 1=1
  `;
  const params: unknown[] = [];

  if (filter.status && filter.status !== "all") {
    params.push(filter.status);
    sql += ` and r.status = $${params.length}`;
  }

  if (filter.payment_status && filter.payment_status !== "all") {
    params.push(filter.payment_status);
    sql += ` and r.payment_status = $${params.length}`;
  }

  params.push(filter.limit || 200);
  sql += ` order by r.updated_at desc limit $${params.length}`;

  return query(sql, params);
}

export async function updateRequestStatus(requestId: number, mentorId: number, status: "accepted" | "rejected" | "completed") {
  return transaction(async (client) => {
    const requestCheck = await one<any>(
      `select * from app.mentorship_requests where id = $1 and mentor_id = $2`,
      [requestId, mentorId],
      client
    );

    if (!requestCheck) {
      return null;
    }

    if (status === "completed") {
      // All agreed agendas must be marked as solved
      const unsolvedAgendas = await query(
        `select id from app.mentorship_agendas where request_id = $1 and status != 'solved'`,
        [requestId],
        client
      );
      if (unsolvedAgendas.length > 0) {
        throw new Error("Cannot complete mentorship request. All agreed agendas must be fully solved with student consent.");
      }
    }

    const request = await one<any>(
      `update app.mentorship_requests
       set status = $1, updated_at = now()
       where id = $2 and mentor_id = $3
       returning *`,
      [status, requestId, mentorId],
      client
    );

    if (request) {
      const mentor = await one<{ display_name: string }>(
        `select display_name from app.mentor_profiles where user_id = $1`,
        [mentorId],
        client
      );
      const mentorName = mentor?.display_name || "Your mentor";

      await createNotification(
        request.user_id,
        "request_updated",
        "Mentorship Request Updated",
        `Your request with ${mentorName} has been ${status}.`,
        "/dashboard/mentorship",
        client
      );
    }

    return request;
  });
}

export async function offerSlots(requestId: number, mentorId: number, slotIds: number[]) {
  const request = await one<any>(
    `update app.mentorship_requests
     set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('offered_slot_ids', $1::jsonb),
         updated_at = now()
     where id = $2 and mentor_id = $3
     returning *`,
    [JSON.stringify(slotIds), requestId, mentorId]
  );

  if (request) {
    const mentor = await one<{ display_name: string }>(
      `select display_name from app.mentor_profiles where user_id = $1`,
      [mentorId]
    );
    const mentorName = mentor?.display_name || "Your mentor";

    await createNotification(
      request.user_id,
      "slots_offered",
      "Scheduling Slots Offered",
      `${mentorName} has offered scheduling slots for your request.`,
      "/dashboard/mentorship"
    );
  }

  return request;
}

async function assertNoUnagreedAgendas(requestId: number, client?: DbClient) {
  const unagreedAgendas = await query(
    `select id from app.mentorship_agendas where request_id = $1 and status = 'proposed'`,
    [requestId],
    client
  );
  if (unagreedAgendas.length > 0) {
    throw new Error("All proposed agendas must be agreed upon by both parties before proceeding to payment.");
  }
}

type MentorshipRazorpayOrderResult = {
  order_id: string;
  currency: string;
  amount: number;
  key_id: string;
  simulated: boolean;
};

/** Creates a Razorpay order for a mentorship request's consultation fee.
 * Falls back to a simulated order when Razorpay keys aren't configured (dev/test). */
export async function createMentorshipPaymentOrder(requestId: number, userId: number): Promise<MentorshipRazorpayOrderResult> {
  const request = await one<any>(
    `select * from app.mentorship_requests where id = $1 and user_id = $2`,
    [requestId, userId]
  );
  if (!request) {
    const err = new Error("Mentorship request not found.") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  if (request.payment_status === "paid") {
    throw new Error("This request has already been paid for.");
  }

  await assertNoUnagreedAgendas(requestId);

  const amountMinor = Number(request.payment_amount) * 100; // rupees -> paise
  const currency = request.payment_currency || "INR";

  const keyId = config.RAZORPAY_KEY_ID;
  const keySecret = config.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    const simulatedOrderId = `sim_order_mentorship_${requestId}_${Date.now()}`;
    return {
      order_id: simulatedOrderId,
      currency,
      amount: amountMinor,
      key_id: "rzp_test_SIMULATED",
      simulated: true
    };
  }

  const orderPayload = {
    amount: amountMinor,
    currency,
    receipt: `mentorship_req_${requestId}_${Date.now()}`,
    notes: {
      mentorship_request_id: String(requestId),
      user_id: String(userId),
      mentor_id: String(request.mentor_id)
    }
  };

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const resp = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`
    },
    body: JSON.stringify(orderPayload)
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Razorpay order creation failed: ${errBody}`);
  }

  const rzpOrder = (await resp.json()) as { id: string; currency: string; amount: number };
  return {
    order_id: rzpOrder.id,
    currency: rzpOrder.currency,
    amount: rzpOrder.amount,
    key_id: keyId,
    simulated: false
  };
}

/** Verifies a completed Razorpay payment (or accepts a simulated one) and marks the
 * mentorship request as paid + accepted. */
export async function verifyMentorshipPayment(requestId: number, userId: number, payload: VerifyMentorshipPaymentInput) {
  return transaction(async (client) => {
    const request = await one<any>(
      `select * from app.mentorship_requests where id = $1 and user_id = $2`,
      [requestId, userId],
      client
    );
    if (!request) {
      const err = new Error("Mentorship request not found.") as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    if (request.payment_status === "paid") {
      throw new Error("This request has already been paid for.");
    }

    await assertNoUnagreedAgendas(requestId, client);

    const keySecret = config.RAZORPAY_KEY_SECRET;
    const isSimulated = payload.razorpay_order_id.startsWith("sim_order_");

    if (!isSimulated && keySecret) {
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
        .digest("hex");

      if (expectedSignature !== payload.razorpay_signature) {
        const err = new Error("Payment signature verification failed.") as Error & { statusCode?: number };
        err.statusCode = 400;
        throw err;
      }
    }

    const paymentMeta = {
      provider: isSimulated ? "simulated" : "razorpay",
      razorpay_order_id: payload.razorpay_order_id,
      razorpay_payment_id: payload.razorpay_payment_id,
      paid_at: new Date().toISOString()
    };

    const updated = await one<any>(
      `update app.mentorship_requests
       set payment_status = 'paid', status = 'accepted',
           meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('payment', $1::jsonb),
           updated_at = now()
       where id = $2 and user_id = $3
       returning *`,
      [JSON.stringify(paymentMeta), requestId, userId],
      client
    );

    await createNotification(
      request.mentor_id,
      "payment_received",
      "Payment Received",
      "Payment for a mentorship request has been received and confirmed. You can now offer scheduling slots.",
      "/mentor/workspace?tab=requests",
      client
    );

    return updated;
  });
}

export async function acceptSlotAndBook(requestId: number, userId: number, slotId: number) {
  return transaction(async (client) => {
    // 1. Get request
    const request = await one<any>(
      `select * from app.mentorship_requests
       where id = $1 and user_id = $2
       limit 1`,
      [requestId, userId],
      client
    );

    if (!request) throw new Error("Request not found.");
    if (request.status !== "accepted") throw new Error("Request must be accepted before booking.");
    if (request.payment_status !== "paid") throw new Error("Request must be paid before booking.");

    // 2. Get and lock slot
    const slot = await one<any>(
      `select * from app.mentorship_slots
       where id = $1 and is_active = true and booked_count < max_bookings
       for update`,
      [slotId],
      client
    );

    if (!slot) throw new Error("Selected slot is not available or fully booked.");

    // 3. Increment slot bookings
    await client.query(
      `update app.mentorship_slots
       set booked_count = booked_count + 1, updated_at = now()
       where id = $1`,
      [slotId]
    );

    // 4. Update request slot
    const updatedRequest = await one<any>(
      `update app.mentorship_requests
       set scheduled_slot_id = $1, updated_at = now()
       where id = $2
       returning *`,
      [slotId, requestId],
      client
    );

    // 5. Create session
    const session = await one<any>(
      `insert into app.mentorship_sessions
       (request_id, slot_id, mentor_id, user_id, mode, starts_at, ends_at, meeting_link, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
       on conflict (request_id) do update set
         slot_id = excluded.slot_id,
         starts_at = excluded.starts_at,
         ends_at = excluded.ends_at,
         meeting_link = excluded.meeting_link,
         status = 'scheduled',
         updated_at = now()
       returning *`,
      [
        requestId,
        slotId,
        request.mentor_id,
        request.user_id,
        slot.mode,
        slot.starts_at,
        slot.ends_at,
        slot.meeting_link || `https://meet.jit.si/CoachingMentorshipRoom-${requestId}`,
        slot.starts_at
      ],
      client
    );

    const student = await one<{ username: string }>(
      `select username from app.users where id = $1`,
      [userId],
      client
    );
    const studentName = student?.username || "A student";
    const dateStr = new Date(slot.starts_at).toLocaleDateString();

    await createNotification(
      request.mentor_id,
      "session_booked",
      "Mentorship Session Booked",
      `${studentName} has scheduled a session for ${dateStr}.`,
      "/mentor/workspace?tab=calendar",
      client
    );

    return { request: updatedRequest, session };
  });
}

export async function startSessionNow(requestId: number, mentorId: number) {
  return transaction(async (client) => {
    const request = await one<any>(
      `select * from app.mentorship_requests
       where id = $1 and mentor_id = $2
       limit 1`,
      [requestId, mentorId],
      client
    );

    if (!request) throw new Error("Request not found.");

    const starts = new Date();
    const ends = new Date(starts.getTime() + 45 * 60 * 1000); // 45 minute duration

    const session = await one(
      `insert into app.mentorship_sessions
       (request_id, slot_id, mentor_id, user_id, mode, starts_at, ends_at, meeting_link, status)
       values ($1, null, $2, $3, 'video', $4, $5, $6, 'scheduled')
       on conflict (request_id) do update set
         starts_at = excluded.starts_at,
         ends_at = excluded.ends_at,
         meeting_link = excluded.meeting_link,
         status = 'scheduled',
         updated_at = now()
       returning *`,
      [
        requestId,
        mentorId,
        request.user_id,
        starts.toISOString(),
        ends.toISOString(),
        `https://meet.jit.si/CoachingMentorshipRoom-${requestId}`
      ],
      client
    );

    return session;
  });
}

// --- Chat Thread Logic ---

export async function sendMessage(requestId: number, senderId: number, body: string) {
  return transaction(async (client) => {
    // Verify request exists and user is participant
    const request = await one<any>(
      `select * from app.mentorship_requests where id = $1`,
      [requestId],
      client
    );

    if (!request) {
      throw new Error("Request not found.");
    }

    if (Number(request.user_id) !== senderId && Number(request.mentor_id) !== senderId) {
      throw new Error("You are not a participant in this request discussion.");
    }

    const message = await one<any>(
      `insert into app.mentorship_messages (request_id, sender_id, body)
       values ($1, $2, $3)
       returning *`,
      [requestId, senderId, body],
      client
    );

    // Update updated_at of requests to bubble it to top in inbox lists
    await client.query(
      `update app.mentorship_requests set updated_at = now() where id = $1`,
      [requestId]
    );

    const recipientId = Number(request.user_id) === senderId ? Number(request.mentor_id) : Number(request.user_id);

    const sender = await one<{ username: string }>(
      `select username from app.users where id = $1`,
      [senderId],
      client
    );
    const senderName = sender?.username || "Someone";

    const link = recipientId === request.mentor_id
      ? "/mentor/workspace?tab=requests"
      : "/dashboard/mentorship";

    await createNotification(
      recipientId,
      "chat_message",
      "New Message",
      `${senderName}: ${body.length > 60 ? body.substring(0, 60) + "..." : body}`,
      link,
      client
    );

    return message;
  });
}

export async function listMessages(requestId: number, userId: number, userRole?: string) {
  // Check if participant (admins/moderators may view any thread for oversight/disputes)
  const request = await one<any>(
    `select user_id, mentor_id from app.mentorship_requests where id = $1`,
    [requestId]
  );

  if (!request) {
    throw new Error("Request not found.");
  }

  const isParticipant = Number(request.user_id) === userId || Number(request.mentor_id) === userId;
  const isStaff = userRole === "admin" || userRole === "moderator";
  if (!isParticipant && !isStaff) {
    throw new Error("You are not authorized to view this chat history.");
  }

  return query(
    `select m.*, u.username as sender_username
     from app.mentorship_messages m
     join app.users u on u.id = m.sender_id
     where m.request_id = $1
     order by m.created_at asc`,
    [requestId]
  );
}

// --- Agora Integration Helper ---

/** 1:1 mentorship calls are symmetric -- both participants publish audio/video,
 * so both are issued a "host" (publisher) role token. */
export function generateAgoraToken(channelName: string, userId: number) {
  const { appId, token, uid, expiresInSeconds } = generateAgoraRtcToken(channelName, userId, "host");
  return {
    appId,
    token,
    channelName,
    uid,
    expiresAt: Math.floor(Date.now() / 1000) + expiresInSeconds
  };
}

export async function updateMentorProfile(userId: number, payload: UpdateMentorProfileInput) {
  const existing = await getMentorProfile(userId);
  if (!existing) {
    throw new Error("Mentor profile not found.");
  }

  const displayName = payload.display_name !== undefined ? payload.display_name : existing.display_name;
  const headline = payload.headline !== undefined ? payload.headline : existing.headline;
  const bio = payload.bio !== undefined ? payload.bio : existing.bio;
  const yearsExperience = payload.years_experience !== undefined ? payload.years_experience : existing.years_experience;
  const city = payload.city !== undefined ? payload.city : existing.city;
  const profileImageUrl = payload.profile_image_url !== undefined ? payload.profile_image_url : existing.profile_image_url;
  const contactUrl = payload.contact_url !== undefined ? payload.contact_url : existing.contact_url;
  const publicEmail = payload.public_email !== undefined ? payload.public_email : existing.public_email;
  const education = payload.education !== undefined ? payload.education : existing.education;
  const specializationTags = payload.specialization_tags !== undefined ? payload.specialization_tags : existing.specialization_tags;
  const highlights = payload.highlights !== undefined ? payload.highlights : existing.highlights;
  const credentials = payload.credentials !== undefined ? payload.credentials : existing.credentials;
  const isPublic = payload.is_public !== undefined ? payload.is_public : existing.is_public;
  const isActive = payload.is_active !== undefined ? payload.is_active : existing.is_active;
  const specifications = payload.specifications !== undefined ? payload.specifications : (existing.specifications || []);
  const exams = payload.exams !== undefined ? payload.exams : (existing.exams || []);
  const specializationType = payload.specialization_type !== undefined ? payload.specialization_type : (existing.specialization_type || "all_areas");
  const mentorType = payload.mentor_type !== undefined ? payload.mentor_type : (existing.mentor_type || "evaluation_mentorship");

  const existingMeta = existing.meta || {};
  const newMeta = {
    ...existingMeta,
    evaluation_source: payload.evaluation_source !== undefined ? payload.evaluation_source : existingMeta.evaluation_source || "any_source",
    question_pdfs: payload.question_pdfs !== undefined ? payload.question_pdfs : existingMeta.question_pdfs || []
  };

  return one(
    `update app.mentor_profiles set
       display_name = $1,
       headline = $2,
       bio = $3,
       years_experience = $4,
       city = $5,
       profile_image_url = $6,
       contact_url = $7,
       public_email = $8,
       education = $9,
       specialization_tags = $10,
       highlights = $11,
       credentials = $12,
       is_public = $13,
       is_active = $14,
       specifications = $15,
       exams = $16,
       specialization_type = $17,
       mentor_type = $18,
       meta = $19,
       updated_at = now()
     where user_id = $20
     returning *`,
    [
      displayName,
      headline,
      bio,
      yearsExperience,
      city,
      profileImageUrl,
      contactUrl,
      publicEmail,
      education,
      specializationTags,
      highlights,
      credentials,
      isPublic,
      isActive,
      specifications,
      exams,
      specializationType,
      mentorType,
      JSON.stringify(newMeta),
      userId
    ]
  );
}

/** Called from the assessment module once a mentor submits/updates an evaluation
 * for a mains_answer_attempt that is linked to one of their mentorship requests. */
export async function notifyMentorshipEvaluationReady(requestId: number, studentUserId: number) {
  return createNotification(
    studentUserId,
    "evaluation_submitted",
    "Your Copy Has Been Evaluated",
    "Your mentor has finished evaluating your answer copy. View your score, feedback and checked copy now.",
    "/dashboard/mentorship"
  );
}

// --- Notifications Logic ---

export async function createNotification(
  userId: number,
  type: string,
  title: string,
  message: string,
  link?: string | null,
  client?: DbClient
) {
  return one(
    `insert into app.notifications (user_id, type, title, message, link)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [userId, type, title, message, link || null],
    client
  );
}

export async function listNotifications(userId: number, limit = 50) {
  return query(
    `select * from app.notifications
     where user_id = $1
     order by is_read asc, created_at desc
     limit $2`,
    [userId, limit]
  );
}

export async function markNotificationAsRead(userId: number, notificationId: number) {
  return one(
    `update app.notifications
     set is_read = true, updated_at = now()
     where id = $1 and user_id = $2
     returning *`,
    [notificationId, userId]
  );
}

export async function markAllNotificationsAsRead(userId: number) {
  return query(
    `update app.notifications
       set is_read = true, updated_at = now()
       where user_id = $1 and is_read = false
       returning *`,
      [userId]
    );
  }

// --- Mentorship Agendas Logic ---

export async function createAgenda(requestId: number, userId: number, payload: CreateAgendaInput) {
  return transaction(async (client) => {
    const request = await one<any>(
      `select * from app.mentorship_requests where id = $1`,
      [requestId],
      client
    );
    if (!request) {
      throw new Error("Mentorship request not found.");
    }

    if (Number(request.user_id) !== userId && Number(request.mentor_id) !== userId) {
      throw new Error("You are not authorized to propose agendas for this request.");
    }

    if (["completed", "rejected", "cancelled", "expired"].includes(request.status)) {
      throw new Error("Agendas cannot be proposed on a closed mentorship request.");
    }

    const agendaMeta = {
      attached_question: payload.attached_question || null
    };

    const agenda = await one<any>(
      `insert into app.mentorship_agendas (request_id, title, description, status, created_by, meta)
       values ($1, $2, $3, 'proposed', $4, $5)
       returning *`,
      [requestId, payload.title, payload.description || null, userId, JSON.stringify(agendaMeta)],
      client
    );

    const recipientId = Number(request.user_id) === userId ? Number(request.mentor_id) : Number(request.user_id);
    const proposer = await one<{ username: string }>(
      `select username from app.users where id = $1`,
      [userId],
      client
    );
    const proposerName = proposer?.username || "A user";

    const link = recipientId === Number(request.mentor_id)
      ? "/mentor/workspace?tab=requests"
      : "/dashboard/mentorship";

    await createNotification(
      recipientId,
      "agenda_proposed",
      "New Agenda Proposed",
      `${proposerName} has proposed a new mentorship agenda: "${payload.title}".`,
      link,
      client
    );

    return agenda;
  });
}

export async function listAgendas(requestId: number) {
  return query(
    `select a.*, u.username as creator_username
     from app.mentorship_agendas a
     join app.users u on u.id = a.created_by
     where a.request_id = $1
     order by a.created_at asc`,
    [requestId]
  );
}

export async function agreeToAgenda(agendaId: number, userId: number) {
  return transaction(async (client) => {
    const agenda = await one<any>(
      `select a.*, r.user_id as learner_id, r.mentor_id
       from app.mentorship_agendas a
       join app.mentorship_requests r on r.id = a.request_id
       where a.id = $1`,
      [agendaId],
      client
    );

    if (!agenda) {
      throw new Error("Agenda not found.");
    }

    if (Number(agenda.created_by) === userId) {
      throw new Error("You cannot agree to your own proposed agenda. The other party must agree.");
    }

    if (Number(agenda.learner_id) !== userId && Number(agenda.mentor_id) !== userId) {
      throw new Error("You are not authorized to agree to this agenda.");
    }

    if (agenda.status !== "proposed") {
      throw new Error("Only proposed agendas can be agreed to.");
    }

    const updated = await one<any>(
      `update app.mentorship_agendas
       set status = 'agreed', updated_at = now()
       where id = $1
       returning *`,
      [agendaId],
      client
    );

    await createNotification(
      agenda.created_by,
      "agenda_agreed",
      "Agenda Agreed",
      `The other party agreed to the agenda: "${agenda.title}".`,
      Number(agenda.created_by) === Number(agenda.mentor_id) ? "/mentor/workspace?tab=requests" : "/dashboard/mentorship",
      client
    );

    return updated;
  });
}

export async function proposeSolveAgenda(agendaId: number, userId: number) {
  return transaction(async (client) => {
    const agenda = await one<any>(
      `select a.*, r.user_id as learner_id, r.mentor_id
       from app.mentorship_agendas a
       join app.mentorship_requests r on r.id = a.request_id
       where a.id = $1`,
      [agendaId],
      client
    );

    if (!agenda) {
      throw new Error("Agenda not found.");
    }

    if (Number(agenda.mentor_id) !== userId) {
      throw new Error("Only the mentor can mark an agenda as solved.");
    }

    if (agenda.status !== "agreed") {
      throw new Error("Agendas must be agreed before they can be marked as solved.");
    }

    const updated = await one<any>(
      `update app.mentorship_agendas
       set status = 'solved_proposed', updated_at = now()
       where id = $1
       returning *`,
      [agendaId],
      client
    );

    await createNotification(
      agenda.learner_id,
      "agenda_solved_proposed",
      "Agenda Solve Proposed",
      `The mentor proposed to mark "${agenda.title}" as solved. Please confirm.`,
      "/dashboard/mentorship",
      client
    );

    return updated;
  });
}

export async function confirmSolveAgenda(agendaId: number, userId: number) {
  return transaction(async (client) => {
    const agenda = await one<any>(
      `select a.*, r.user_id as learner_id, r.mentor_id
       from app.mentorship_agendas a
       join app.mentorship_requests r on r.id = a.request_id
       where a.id = $1`,
      [agendaId],
      client
    );

    if (!agenda) {
      throw new Error("Agenda not found.");
    }

    if (Number(agenda.learner_id) !== userId) {
      throw new Error("Only the student can confirm that this agenda is solved.");
    }

    if (agenda.status !== "solved_proposed") {
      throw new Error("The mentor must propose the agenda solve before you can confirm it.");
    }

    const updated = await one<any>(
      `update app.mentorship_agendas
       set status = 'solved', updated_at = now()
       where id = $1
       returning *`,
      [agendaId],
      client
    );

    await createNotification(
      agenda.mentor_id,
      "agenda_solved",
      "Agenda Solved Confirmed",
      `The student confirmed that the agenda "${agenda.title}" is solved.`,
      "/mentor/workspace?tab=requests",
      client
    );

    return updated;
  });
}

export async function deleteAgenda(agendaId: number, userId: number) {
  return transaction(async (client) => {
    const agenda = await one<any>(
      `select * from app.mentorship_agendas where id = $1`,
      [agendaId],
      client
    );

    if (!agenda) {
      throw new Error("Agenda not found.");
    }

    if (Number(agenda.created_by) !== userId) {
      throw new Error("You are not authorized to delete this agenda.");
    }

    if (agenda.status !== "proposed") {
      throw new Error("Only a still-proposed agenda (not yet agreed) can be deleted.");
    }

    await client.query(
      `delete from app.mentorship_agendas where id = $1`,
      [agendaId]
    );

    return { id: agendaId, success: true };
  });
}

// --- Settings Logic ---

export async function getMentorshipSettings(): Promise<Record<string, string[]>> {
  const rows = await query<{ key: string; value: string[] }>(
    `select key, value from app.mentorship_settings`
  );
  const settings: Record<string, string[] | any> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function updateMentorshipSetting(key: string, value: string[]): Promise<any> {
  return one(
    `insert into app.mentorship_settings (key, value, updated_at)
     values ($1, $2, now())
     on conflict (key) do update
     set value = excluded.value, updated_at = now()
     returning *`,
    [key, JSON.stringify(value)]
  );
}


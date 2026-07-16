import { query } from "../../db.js";
import { getUserEntitlements } from "../billing/service.js";

// One-time (not monthly) lifetime allowance of self-built tests for
// non-premium users, shared uniformly across GK/CSAT/Mains.
export const FREE_TEST_LIMIT = 3;

// The only test_type values a student can create themselves (via the compiled
// builder, dynamic quick-test, single-mains-question practice, or the custom
// test wizard). Admin-curated content (diagnostic_test, full_length_test,
// pyq_test) never counts against this allowance.
const SELF_BUILT_TEST_TYPES = ["quick_test", "sectional_test", "mains_test"];

export async function getFreeTestUsage(
  userId: number
): Promise<{ used: number; limit: number; hasPremium: boolean }> {
  const entitlements = await getUserEntitlements(userId);
  const hasPremium = entitlements.some((e) => e.entitlement_key === "assessment.premium_tests");
  if (hasPremium) {
    return { used: 0, limit: FREE_TEST_LIMIT, hasPremium: true };
  }

  // access_type varies by creation path ('free' for compiled/dynamic/single-question,
  // 'private' for the custom test wizard) so we don't filter on it — created_by_user_id
  // is the reliable ownership signal.
  const rows = await query<{ count: string }>(
    `
      select count(*)::text as count
      from assessment.test_templates
      where created_by_user_id = $1
        and test_type = any($2::text[])
    `,
    [userId, SELF_BUILT_TEST_TYPES]
  );
  const used = Number(rows[0]?.count ?? 0);
  return { used, limit: FREE_TEST_LIMIT, hasPremium: false };
}

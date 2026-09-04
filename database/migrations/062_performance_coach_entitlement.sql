-- Sell the AI performance coach with Assessment Premium.
-- Date: 2026-09-04
--
-- The coach ships gated on `assessment.performance_coach` (see
-- assertHasPerformanceCoachAccess), and a gate with no plan behind it refuses
-- everyone -- paying subscribers and staff alike. This attaches the key to the
-- Assessment Premium plan, and to the bundle, which carries every key from
-- both plans.
--
-- Follows migration 027's shape exactly: select the plan by code rather than by
-- id, and leave existing rows alone, so re-running is harmless and an
-- environment whose plan ids differ still gets the right rows.

insert into billing.entitlements (plan_id, entitlement_key, limit_value, metadata)
select p.id, 'assessment.performance_coach', null, '{}'
from billing.plans p
where p.code = 'assessment_premium'
on conflict (plan_id, entitlement_key) do nothing;

insert into billing.entitlements (plan_id, entitlement_key, limit_value, metadata)
select p.id, 'assessment.performance_coach', null, '{}'
from billing.plans p
where p.code = 'assessment_ca_bundle'
on conflict (plan_id, entitlement_key) do nothing;

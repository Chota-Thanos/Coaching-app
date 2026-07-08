-- Migration: Add payment tracking columns to study_plan.enrollments (fixing typo in 027)
-- Date: 2026-07-08

alter table study_plan.enrollments
  add column if not exists payment_status text not null default 'free'
    check (payment_status in ('free', 'pending', 'paid', 'refunded', 'failed')),
  add column if not exists payment_amount integer not null default 0,
  add column if not exists payment_currency text not null default 'INR',
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text;

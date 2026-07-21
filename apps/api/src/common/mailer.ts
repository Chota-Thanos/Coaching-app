import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config.js";

/**
 * Provider-agnostic outbound email over SMTP. Works with Resend, AWS SES,
 * SendGrid, Postmark, Gmail — anything that speaks SMTP.
 *
 * When SMTP_HOST is not configured the mailer degrades gracefully: it logs the
 * message instead of sending and reports `delivered: false`. This mirrors the
 * Razorpay "simulated mode" pattern already used in this codebase, so dev and
 * staging keep working without credentials, and callers must never treat a
 * failed send as a failed operation (an unverified email is recoverable; a
 * 500 on registration is not).
 */

let transporter: Transporter | null = null;

export function isMailConfigured(): boolean {
  return Boolean(config.SMTP_HOST);
}

function getTransporter(): Transporter | null {
  if (!isMailConfigured()) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth:
      config.SMTP_USER && config.SMTP_PASSWORD
        ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
        : undefined
  });
  return transporter;
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail(input: SendMailInput): Promise<{ delivered: boolean; reason?: string }> {
  const tx = getTransporter();
  if (!tx) {
    console.warn(
      `[mailer] SMTP not configured — email NOT sent. to=${input.to} subject="${input.subject}"`
    );
    return { delivered: false, reason: "smtp_not_configured" };
  }

  try {
    await tx.sendMail({
      from: config.MAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html)
    });
    return { delivered: true };
  } catch (err: any) {
    console.error("[mailer] send failed:", err?.message ?? err);
    return { delivered: false, reason: err?.message ?? "send_failed" };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function layout(title: string, body: string, cta?: { label: string; url: string }): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f1f5fb;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #dde6f0">
      <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">${title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#334155">${body}</div>
      ${
        cta
          ? `<div style="margin:28px 0 8px">
               <a href="${cta.url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px">${cta.label}</a>
             </div>
             <p style="font-size:12px;color:#64748b;word-break:break-all">If the button doesn't work, paste this link into your browser:<br>${cta.url}</p>`
          : ""
      }
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#94a3b8;margin:0">WayToIAS · This is an automated message, please don't reply.</p>
    </div>
  </div>`;
}

export function verificationEmail(username: string, url: string) {
  return {
    subject: "Verify your WayToIAS email address",
    html: layout(
      "Confirm your email",
      `<p>Hi ${escapeHtml(username)},</p>
       <p>Please confirm this email address to secure your WayToIAS account. This link expires in 24 hours.</p>`,
      { label: "Verify email", url }
    )
  };
}

export function passwordResetEmail(username: string, url: string) {
  return {
    subject: "Reset your WayToIAS password",
    html: layout(
      "Reset your password",
      `<p>Hi ${escapeHtml(username)},</p>
       <p>We received a request to reset your password. This link expires in 1 hour and can only be used once.</p>
       <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
      { label: "Reset password", url }
    )
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

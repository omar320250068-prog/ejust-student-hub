/**
 * Outbound mail for E-JUST Hub OTPs (email verification and password reset).
 *
 * Provider order: SMTP -> Gmail API -> Resend. SMTP is preferred whenever
 * SMTP_HOST and EMAIL_FROM are configured, so any student-domain recipient can
 * receive a code without the Resend sandbox restriction. Gmail API and Resend
 * remain as fallbacks. In development, when no provider is configured we log
 * the code instead of failing so flows remain testable. In production, with no
 * working provider, callers get an explicit failure and should respond 503
 * rather than silently "sending" a code nobody received.
 */
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";

export type MailResult =
  | { ok: true; provider: "resend" | "smtp" | "gmail" | "dev" }
  | { ok: false; reason: "unavailable" };

export type OtpPurpose = "verification" | "password-reset";

interface MailContent {
  subject: string;
  text: string;
  html: string;
}

const MAIL_TIMEOUT_MS = 10_000;

function mailContent(code: string, purpose: OtpPurpose): MailContent {
  const reset = purpose === "password-reset";
  const label = reset ? "password reset" : "verification";
  const subject = reset
    ? "Reset your E-JUST Hub password"
    : "Your E-JUST Hub verification code";
  return {
    subject,
    text:
      `Your E-JUST Hub ${label} code is ${code}.\n\n` +
      `It expires in 10 minutes. If you did not request it, you can ignore this email.`,
    html:
      `<div style="font-family:Arial,sans-serif;line-height:1.6">` +
      `<p>Your E-JUST Hub ${label} code is:</p>` +
      `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>` +
      `<p>It expires in 10 minutes. If you did not request it, you can ignore this email.</p>` +
      `</div>`,
  };
}

/** RFC 2047 encode non-ASCII header values (e.g. an Arabic display name). */
function encodeMimeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function gmailFromHeader(): string {
  const raw = process.env.EMAIL_FROM?.trim();
  if (!raw) throw new Error("EMAIL_FROM is missing (required for the Gmail From header)");
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (!match) return encodeMimeHeader(raw);
  const displayName = match[1].trim();
  return displayName
    ? `${encodeMimeHeader(displayName)} <${match[2].trim()}>`
    : match[2].trim();
}

function base64MimeBody(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function gmailMimeMessage(to: string, content: MailContent): string {
  const boundary = `----=_EjustHub_${randomUUID()}`;
  return [
    `From: ${gmailFromHeader()}`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(content.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64MimeBody(content.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64MimeBody(content.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function gmailConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_CLIENT_ID?.trim() &&
    process.env.GMAIL_CLIENT_SECRET?.trim() &&
    process.env.GMAIL_REFRESH_TOKEN?.trim()
  );
}

function gmailApiError(step: string, status: number, body: string): Error {
  const scopeHint = /insufficient|scope/i.test(body)
    ? " Ensure the OAuth client has https://www.googleapis.com/auth/gmail.send scope and re-consent the refresh token."
    : "";
  return new Error(`Gmail ${step} returned ${status}: ${body}${scopeHint}`);
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), MAIL_TIMEOUT_MS);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

async function sendViaResend(to: string, content: MailContent): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const response = await withTimeout(
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || "E-JUST Hub <onboarding@resend.dev>",
        to: [to],
        subject: content.subject,
        text: content.text,
        html: content.html,
      }),
      cache: "no-store",
    }),
    "Resend request timed out"
  );
  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!host || !from) return null;
  const port = Number(process.env.SMTP_PORT || "587");
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  // Port 465 is implicit TLS; other ports use STARTTLS when offered.
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  return {
    host,
    port,
    secure,
    from,
    user: process.env.SMTP_USER?.trim() || undefined,
    password:
      process.env.SMTP_PASS?.trim() || process.env.SMTP_PASSWORD?.trim() || undefined,
  };
}

async function sendViaSmtp(cfg: SmtpConfig, to: string, content: MailContent): Promise<void> {
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    ...(cfg.user && cfg.password ? { auth: { user: cfg.user, pass: cfg.password } } : {}),
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
  });

  try {
    await withTimeout(
      transport.sendMail({
        from: cfg.from,
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      }),
      "SMTP send timed out"
    );
  } finally {
    transport.close();
  }
}

async function gmailAccessToken(): Promise<string> {
  const clientId = process.env.GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Gmail credentials missing");

  const response = await withTimeout(
    fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    }),
    "Gmail token request timed out"
  );
  const body = await response.text();
  if (!response.ok) throw gmailApiError("token request", response.status, body);
  let data: { access_token?: string };
  try {
    data = JSON.parse(body) as { access_token?: string };
  } catch {
    throw new Error(`Gmail token response was not JSON: ${body}`);
  }
  if (!data.access_token) throw new Error(`Gmail token response had no access_token: ${body}`);
  return data.access_token;
}

async function sendViaGmail(to: string, content: MailContent): Promise<void> {
  const accessToken = await gmailAccessToken();
  const response = await withTimeout(
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: Buffer.from(gmailMimeMessage(to, content), "utf8").toString("base64url"),
      }),
      cache: "no-store",
    }),
    "Gmail send timed out"
  );
  if (!response.ok) throw gmailApiError("send", response.status, await response.text());
}

/** Send an OTP with copy that matches its purpose. */
export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: OtpPurpose = "verification"
): Promise<MailResult> {
  const content = mailContent(code, purpose);
  const failures: string[] = [];

  const smtp = smtpConfig();
  if (smtp) {
    try {
      await sendViaSmtp(smtp, email, content);
      console.info(`[mailer] ${purpose} OTP delivered via smtp`);
      return { ok: true, provider: "smtp" };
    } catch (error) {
      const message = (error as Error).message;
      failures.push(`smtp: ${message}`);
      console.warn(`[mailer] smtp failed: ${message}`);
    }
  }

  if (gmailConfigured()) {
    try {
      await sendViaGmail(email, content);
      console.info(`[mailer] ${purpose} OTP delivered via gmail`);
      return { ok: true, provider: "gmail" };
    } catch (error) {
      const message = (error as Error).message;
      failures.push(`gmail: ${message}`);
      console.warn(`[mailer] gmail failed: ${message}`);
    }
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    try {
      await sendViaResend(email, content);
      console.info(`[mailer] ${purpose} OTP delivered via resend`);
      return { ok: true, provider: "resend" };
    } catch (error) {
      const message = (error as Error).message;
      failures.push(`resend: ${message}`);
      console.warn(`[mailer] resend failed: ${message}`);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[mailer][dev] ${purpose} code for ${email}: ${code}`);
    return { ok: true, provider: "dev" };
  }

  console.error(`[mailer] no ${purpose} email provider succeeded`, failures);
  return { ok: false, reason: "unavailable" };
}

/** Backwards-compatible wrapper for the signup/login verification flow. */
export function sendVerificationEmail(email: string, code: string): Promise<MailResult> {
  return sendOtpEmail(email, code, "verification");
}

export function sendPasswordResetEmail(email: string, code: string): Promise<MailResult> {
  return sendOtpEmail(email, code, "password-reset");
}

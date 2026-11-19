/**
 * Outbound mail for email verification.
 *
 * Provider order: Gmail API -> Resend -> SMTP. Gmail is preferred whenever all
 * three OAuth variables are configured, so student-domain recipients are not
 * limited by the Resend sandbox. In development, when no provider is configured
 * we log the code instead of failing so signup remains testable. In production,
 * with no working provider, callers get an explicit failure and should respond
 * 503 rather than silently "sending" a code nobody received.
 */
import { randomUUID } from "node:crypto";
import net from "node:net";
import tls from "node:tls";

export type MailResult =
  | { ok: true; provider: "resend" | "smtp" | "gmail" | "dev" }
  | { ok: false; reason: "unavailable" };

const SUBJECT = "Your E-JUST Hub verification code";
const MAIL_TIMEOUT_MS = 10_000;

function textBody(code: string): string {
  return (
    `Your E-JUST Hub verification code is ${code}.\n\n` +
    `It expires in 10 minutes. If you did not request it, you can ignore this email.`
  );
}

function htmlBody(code: string): string {
  return (
    `<div style="font-family:Arial,sans-serif;line-height:1.6">` +
    `<p>Your E-JUST Hub verification code is:</p>` +
    `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>` +
    `<p>It expires in 10 minutes. If you did not request it, you can ignore this email.</p>` +
    `</div>`
  );
}

function fromAddress(): string {
  const raw = process.env.EMAIL_FROM?.trim();
  if (!raw) return "";
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim();
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

function gmailMimeMessage(to: string, code: string): string {
  const boundary = `----=_EjustHub_${randomUUID()}`;
  return [
    `From: ${gmailFromHeader()}`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(SUBJECT)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64MimeBody(textBody(code)),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64MimeBody(htmlBody(code)),
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

async function sendViaResend(to: string, code: string): Promise<void> {
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
        subject: SUBJECT,
        text: textBody(code),
        html: htmlBody(code),
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
  const from = fromAddress();
  if (!host || !from) return null;
  const secure = process.env.SMTP_SECURE === "true";
  const port = Number(process.env.SMTP_PORT || (secure ? 465 : 587));
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return {
    host,
    port,
    secure,
    from,
    user: process.env.SMTP_USER?.trim() || undefined,
    password: process.env.SMTP_PASSWORD || undefined,
  };
}

class LineReader {
  private buffer = "";
  private queue: string[] = [];
  private waiters: Array<(line: string) => void> = [];
  private socket: net.Socket | tls.TLSSocket | null = null;

  private readonly onData = (chunk: Buffer) => {
    this.buffer += chunk.toString("utf8");
    let index: number;
    while ((index = this.buffer.indexOf("\r\n")) !== -1) {
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      const waiter = this.waiters.shift();
      if (waiter) waiter(line);
      else this.queue.push(line);
    }
  };

  attach(socket: net.Socket | tls.TLSSocket): void {
    this.socket = socket;
    socket.on("data", this.onData);
  }

  detach(): void {
    this.socket?.off("data", this.onData);
    this.socket = null;
  }

  next(): Promise<string> {
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

async function readReply(reader: LineReader): Promise<string[]> {
  const lines: string[] = [];
  for (;;) {
    const line = await withTimeout(reader.next(), "SMTP reply timed out");
    lines.push(line);
    if (line.length < 4 || line[3] !== "-") return lines;
  }
}

function expect(lines: string[], code: string, step: string): void {
  const actual = lines.at(-1)?.slice(0, 3) ?? "";
  if (actual !== code) {
    throw new Error(`SMTP ${step}: expected ${code}, got ${lines.join(" | ")}`);
  }
}

function waitForConnect(socket: net.Socket | tls.TLSSocket, event: string): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      const onOpen = () => { cleanup(); resolve(); };
      const onError = (error: Error) => { cleanup(); reject(error); };
      const cleanup = () => {
        socket.off(event, onOpen);
        socket.off("error", onError);
      };
      socket.once(event, onOpen);
      socket.once("error", onError);
    }),
    "SMTP connection timed out"
  );
}

/** Minimal SMTP client (implicit TLS, STARTTLS and AUTH LOGIN) — no dependency. */
async function sendViaSmtp(cfg: SmtpConfig, to: string, code: string): Promise<void> {
  const initial: net.Socket | tls.TLSSocket = cfg.secure
    ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
    : net.connect({ host: cfg.host, port: cfg.port });
  let current: net.Socket | tls.TLSSocket = initial;
  const reader = new LineReader();
  reader.attach(initial);
  const write = (line: string) => current.write(`${line}\r\n`);

  try {
    await waitForConnect(initial, cfg.secure ? "secureConnect" : "connect");
    expect(await readReply(reader), "220", "greeting");

    const ehlo = async (): Promise<string[]> => {
      write("EHLO localhost");
      const lines = await readReply(reader);
      expect(lines, "250", "EHLO");
      return lines.map((line) => line.slice(4).toUpperCase());
    };

    let extensions = await ehlo();
    if (!cfg.secure && extensions.some((line) => line.startsWith("STARTTLS"))) {
      write("STARTTLS");
      expect(await readReply(reader), "220", "STARTTLS");
      reader.detach();
      const upgraded = tls.connect({ socket: initial, servername: cfg.host });
      await waitForConnect(upgraded, "secureConnect");
      reader.attach(upgraded);
      current = upgraded;
      extensions = await ehlo();
    }

    if (cfg.user && cfg.password) {
      write("AUTH LOGIN");
      expect(await readReply(reader), "334", "AUTH LOGIN");
      write(Buffer.from(cfg.user).toString("base64"));
      expect(await readReply(reader), "334", "AUTH user");
      write(Buffer.from(cfg.password).toString("base64"));
      expect(await readReply(reader), "235", "AUTH password");
    }
    void extensions;

    write(`MAIL FROM:<${cfg.from}>`);
    expect(await readReply(reader), "250", "MAIL FROM");
    write(`RCPT TO:<${to}>`);
    const rcpt = (await readReply(reader)).at(-1)?.slice(0, 3);
    if (rcpt !== "250" && rcpt !== "251") throw new Error(`SMTP RCPT TO: ${rcpt}`);
    write("DATA");
    expect(await readReply(reader), "354", "DATA");
    current.write(
      [
        `From: ${cfg.from}`,
        `To: ${to}`,
        `Subject: ${SUBJECT}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        textBody(code),
        ".",
        "",
      ].join("\r\n")
    );
    expect(await readReply(reader), "250", "message body");
    write("QUIT");
  } finally {
    reader.detach();
    current.destroy();
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

async function sendViaGmail(to: string, code: string): Promise<void> {
  const accessToken = await gmailAccessToken();
  const response = await withTimeout(
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: Buffer.from(gmailMimeMessage(to, code), "utf8").toString("base64url"),
      }),
      cache: "no-store",
    }),
    "Gmail send timed out"
  );
  if (!response.ok) throw gmailApiError("send", response.status, await response.text());
}

export async function sendVerificationEmail(email: string, code: string): Promise<MailResult> {
  const failures: string[] = [];

  if (gmailConfigured()) {
    try {
      await sendViaGmail(email, code);
      return { ok: true, provider: "gmail" };
    } catch (error) {
      const message = (error as Error).message;
      failures.push(`gmail: ${message}`);
      console.warn(`[mailer] gmail failed: ${message}`);
    }
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    try {
      await sendViaResend(email, code);
      return { ok: true, provider: "resend" };
    } catch (error) {
      const message = (error as Error).message;
      failures.push(`resend: ${message}`);
      console.warn(`[mailer] resend failed: ${message}`);
    }
  }

  const smtp = smtpConfig();
  if (smtp) {
    try {
      await sendViaSmtp(smtp, email, code);
      return { ok: true, provider: "smtp" };
    } catch (error) {
      const message = (error as Error).message;
      failures.push(`smtp: ${message}`);
      console.warn(`[mailer] smtp failed: ${message}`);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[mailer][dev] verification code for ${email}: ${code}`);
    return { ok: true, provider: "dev" };
  }

  console.error("[mailer] no verification email provider succeeded", failures);
  return { ok: false, reason: "unavailable" };
}

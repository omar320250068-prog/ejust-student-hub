/**
 * Pure rate-limit primitives. No framework or database imports so this module
 * can be unit-tested directly and shared by the server store and route guards.
 */

export const TEN_MINUTES_MS = 10 * 60 * 1000;
export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export interface RateLimitPolicy {
  /** Maximum attempts allowed inside the sliding window. */
  limit: number;
  /** Length of the sliding window in milliseconds. */
  windowMs: number;
}

export const RATE_LIMIT_POLICIES = {
  otpSend: { limit: 5, windowMs: TEN_MINUTES_MS },
  otpVerify: { limit: 5, windowMs: TEN_MINUTES_MS },
  register: { limit: 10, windowMs: FIFTEEN_MINUTES_MS },
  login: { limit: 10, windowMs: FIFTEEN_MINUTES_MS },
  assistant: { limit: 20, windowMs: TEN_MINUTES_MS },
  resetRequest: { limit: 5, windowMs: TEN_MINUTES_MS },
  resetVerify: { limit: 5, windowMs: TEN_MINUTES_MS },
} satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

export interface RateLimitDecision {
  allowed: boolean;
  /** Slots left after this request (0 when denied). */
  remaining: number;
  /** Milliseconds until a slot frees up; 0 when allowed. */
  retryAfterMs: number;
}

/**
 * Decide from the attempt timestamps that fall inside the current window,
 * *before* this request is recorded. Timestamps at or before `now - windowMs`
 * have aged out. `retryAfterMs` is derived from the oldest surviving attempt.
 */
export function decideFromAttempts(
  attempts: readonly number[],
  now: number,
  policy: RateLimitPolicy
): RateLimitDecision {
  const cutoff = now - policy.windowMs;
  const recent = attempts.filter((at) => at > cutoff).sort((a, b) => a - b);
  const allowed = recent.length < policy.limit;

  if (!allowed) {
    const oldest = recent[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(1, oldest + policy.windowMs - now),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, policy.limit - recent.length - 1),
    retryAfterMs: 0,
  };
}

/** Build a stable, case-insensitive bucket key from a namespace and subjects. */
export function rateLimitKey(namespace: string, ...subjects: (string | null | undefined)[]): string {
  return [namespace, ...subjects.map((value) => (value ?? "unknown").trim().toLowerCase())].join(":");
}

/**
 * Best-effort client IP for the bucket key. Deployments behind Vercel/proxies
 * provide `x-forwarded-for`; the first hop is the originating client.
 */
export function clientIpFromHeaders(headers: Headers): string {
  for (const name of ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"] as const) {
    const raw = headers.get(name);
    if (!raw) continue;
    const value = (raw.split(",")[0] ?? "").trim();
    if (value) return value;
  }
  return "unknown";
}

/** Common proxy header names are lowercased by the runtime; keep this tolerant. */
export function requestIp(request: { headers: Headers }): string {
  return clientIpFromHeaders(request.headers);
}

export function retryAfterSeconds(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

export function rateLimitHeaders(policy: RateLimitPolicy, decision: RateLimitDecision): Record<string, string> {
  return {
    "Retry-After": String(retryAfterSeconds(decision.retryAfterMs)),
    "X-RateLimit-Limit": String(policy.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
  };
}

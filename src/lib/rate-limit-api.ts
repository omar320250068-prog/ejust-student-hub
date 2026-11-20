/**
 * Route-handler helper for rate limiting. Server-only.
 *
 * Every call checks an IP bucket plus any supplied identity buckets (email and
 * user id), so rotating one subject does not bypass the limit. Denied requests
 * get a stable `rate_limited` JSON body with localized messages and the
 * standard retry/rate-limit headers.
 */
import "server-only";
import { NextResponse } from "next/server";
import { authErrorMessage } from "./auth-messages";
import {
  rateLimitHeaders,
  rateLimitKey,
  RATE_LIMIT_POLICIES,
  requestIp,
  retryAfterSeconds,
  type RateLimitDecision,
  type RateLimitPolicyName,
} from "./rate-limit";
import { consumeRateLimit } from "./rate-limit-store";

export interface RateLimitSubjects {
  email?: string | null;
  userId?: string | null;
}

/**
 * Consume one attempt for this request. Returns a ready-to-return 429 response
 * when any bucket is exhausted, or `null` when the request may proceed.
 */
export async function enforceRateLimit(
  request: Request,
  policyName: RateLimitPolicyName,
  subjects: RateLimitSubjects = {}
): Promise<NextResponse | null> {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const keys = [rateLimitKey(policyName, "ip", requestIp(request))];
  if (subjects.email) keys.push(rateLimitKey(policyName, "email", subjects.email));
  if (subjects.userId) keys.push(rateLimitKey(policyName, "user", subjects.userId));

  const decisions: RateLimitDecision[] = [];
  for (const key of keys) {
    decisions.push(await consumeRateLimit(key, policy));
  }

  const denied = decisions.some((decision) => !decision.allowed);
  const retryAfterMs = Math.max(1, ...decisions.map((decision) => decision.retryAfterMs));
  const remaining = denied ? 0 : Math.min(...decisions.map((decision) => decision.remaining));
  const decision: RateLimitDecision = { allowed: !denied, remaining, retryAfterMs };

  if (!denied) return null;

  const headers = rateLimitHeaders(policy, decision);
  const seconds = retryAfterSeconds(retryAfterMs);
  return NextResponse.json(
    {
      error: "rate_limited",
      message: authErrorMessage("rate_limited", "en"),
      messages: {
        en: authErrorMessage("rate_limited", "en"),
        ar: authErrorMessage("rate_limited", "ar"),
        ja: authErrorMessage("rate_limited", "ja"),
      },
      retryAfter: seconds,
    },
    { status: 429, headers }
  );
}

import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { enforceRateLimit } from "@/lib/rate-limit-api";

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
  // Password sign-in is the brute-force target; the email-OTP callback is
  // already bounded by the OTP attempt count and has its own limits.
  if (request.nextUrl.pathname.endsWith("/callback/credentials")) {
    const limited = await enforceRateLimit(request, "login");
    if (limited) return limited;
  }
  return handlers.POST(request);
}

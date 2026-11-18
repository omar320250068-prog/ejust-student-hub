import type { NextRequest } from "next/server";
import { POST as syncPost } from "../../student/sync/route";

/**
 * Extension-facing alias for the SIS sync endpoint.
 *
 * The full implementation (signed bearer tokens, SIS parsing, upserts) lives in
 * `/api/student/sync`. Keeping a stable extension URL lets the browser client
 * use `/api/sis/sync` without duplicating server logic.
 */
export async function POST(request: NextRequest) {
  return syncPost(request);
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  isAuthPage,
  isPublicPath,
  loginRedirectPath,
  requiresAuthForApi,
  roleAllowsPath,
  safeNextPath,
  STAFF_REDIRECT,
} from "@/lib/auth-gate";

/**
 * Next 16 discovers `proxy` at the same level as `app/`, so this file lives in
 * `src/`. It performs a fast JWT-level gate; pages and APIs keep their
 * DB-backed `getViewer()` / `requireAdmin()` / `requireStaff()` checks.
 */
export const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;

  // Auth pages are public for guests, but signed-in visitors go straight to
  // their destination. This must run before the generic public-path bypass.
  if (request.auth && isAuthPage(pathname)) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    const destination = roleAllowsPath(next, request.auth.user) ? next : STAFF_REDIRECT;
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  if (requiresAuthForApi(pathname)) {
    if (!request.auth) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!roleAllowsPath(pathname, request.auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (!request.auth) {
    return NextResponse.redirect(new URL(loginRedirectPath(pathname, search), request.url));
  }

  if (!roleAllowsPath(pathname, request.auth.user)) {
    return NextResponse.redirect(new URL(STAFF_REDIRECT, request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/:path*"],
};

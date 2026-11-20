/**
 * Pure routing rules shared by the Next 16 proxy, the login page and tests.
 * Keep this module free of Next/React imports so it runs in every runtime.
 */

export const DEFAULT_LOGIN_REDIRECT = "/contribute";
export const STAFF_REDIRECT = "/today";

/** Pages reachable without a session. `/auth/error` is NextAuth's error page. */
const PUBLIC_PAGES = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/error",
]);

/** API namespaces that must stay reachable for authentication and cron jobs. */
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/cron/"] as const;

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function isPublicAsset(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return false;
  if (/^\/_next(?:\/|$)/.test(pathname)) return true;
  if (/^\/(?:favicon\.ico|manifest\.json|robots\.txt|sitemap\.xml)$/.test(pathname)) return true;
  if (/^\/(?:downloads|icons|images|fonts)\//.test(pathname)) return true;
  return /\.(?:svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|map|txt)$/.test(pathname);
}

export function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.has(normalizePath(pathname));
}

export function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** True when a path is public without a session. */
export function isPublicPath(pathname: string): boolean {
  return isPublicAsset(pathname) || isPublicPage(pathname) || isPublicApi(pathname);
}

/** Every API route outside the two public namespaces requires a session. */
export function requiresAuthForApi(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export type RequiredRole = "ADMIN" | "STAFF" | null;

export function requiredRoleForPath(pathname: string): RequiredRole {
  if (/^\/(?:api\/)?admin(?:\/|$)/.test(pathname)) return "ADMIN";
  if (/^\/(?:api\/)?ta(?:\/|$)/.test(pathname)) return "STAFF";
  return null;
}

export interface RoleContext {
  role?: string;
  taStatus?: string;
}

/** JWT-level check only; server pages/APIs must still use DB-backed guards. */
export function roleAllowsPath(pathname: string, user: RoleContext | null | undefined): boolean {
  const required = requiredRoleForPath(pathname);
  if (!required) return true;
  if (!user) return false;
  if (required === "ADMIN") return user.role === "ADMIN";
  return user.role === "ADMIN" || (user.role === "TA" && user.taStatus === "APPROVED");
}

/**
 * Validate a post-login `next` value. Only local absolute paths are accepted;
 * protocol-relative, backslash, control-character and encoded variants are
 * rejected so a crafted link cannot send the user to another origin.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0) return DEFAULT_LOGIN_REDIRECT;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return DEFAULT_LOGIN_REDIRECT;
  }
  if (/[\\\u0000-\u001F\u007F]/.test(raw)) return DEFAULT_LOGIN_REDIRECT;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return DEFAULT_LOGIN_REDIRECT;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/\\")) {
    return DEFAULT_LOGIN_REDIRECT;
  }
  return raw;
}

/** Build the login redirect target, preserving pathname + query string. */
export function loginRedirectPath(pathname: string, search = ""): string {
  const target = `${pathname}${search}`;
  return `/login?next=${encodeURIComponent(target)}`;
}

/** Auth pages are public; signed-in visitors are sent on to a useful tool. */
export function isAuthPage(pathname: string): boolean {
  return ["/login", "/signup", "/forgot-password", "/reset-password"].includes(normalizePath(pathname));
}

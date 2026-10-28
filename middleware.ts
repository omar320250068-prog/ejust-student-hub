import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isDashboard = pathname.startsWith("/dashboard");
  const isOnboarding = pathname.startsWith("/onboarding");
  const isLogin = pathname === "/login";
  const session = request.auth;

  if (!session && (isDashboard || isOnboarding)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!session) {
    return NextResponse.next();
  }

  if (session.user.hasCompletedProfile && (isLogin || isOnboarding)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!session.user.hasCompletedProfile && isDashboard) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/login"],
};

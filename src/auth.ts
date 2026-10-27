import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { recordAuthError } from "@/lib/auth-error-store";

const URL_ENV_KEYS = ["AUTH_URL", "NEXTAUTH_URL"] as const;

function normalizeUrlEnv() {
  for (const key of URL_ENV_KEYS) {
    const raw = process.env[key];
    if (!raw || raw.trim() === "") continue;

    try {
      process.env[key] = new URL(raw.trim()).toString();
      continue;
    } catch {}

    try {
      process.env[key] = new URL(`https://${raw.trim()}`).toString();
      continue;
    } catch {
      delete process.env[key];
    }
  }
}

normalizeUrlEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: (
        process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID
      )?.trim(),
      clientSecret: (
        process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET
      )?.trim(),
    }),
  ],
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  pages: {
    error: "/auth/error",
  },
  logger: {
    error(error) {
      console.error("[auth][error]", error);
      void recordAuthError(error);
    },
  },
});

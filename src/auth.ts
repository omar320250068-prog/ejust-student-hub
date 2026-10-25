import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const URL_ENV_KEYS = ["AUTH_URL", "NEXTAUTH_URL"] as const;

function normalizeUrlEnv() {
  for (const key of URL_ENV_KEYS) {
    const raw = process.env[key];
    if (!raw || raw.trim() === "") continue;

    try {
      new URL(raw);
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
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
});

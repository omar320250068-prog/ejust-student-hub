import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studentProfiles, users } from "@/db/schema";
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
  adapter: DrizzleAdapter(db),
  providers: [
    Google({
      clientId: (
        process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID
      )?.trim(),
      clientSecret: (
        process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET
      )?.trim(),
    }),
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) return null;

        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
            passwordHash: users.passwordHash,
            role: users.role,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      const userId = user?.id ?? token.sub;

      if (userId) {
        const [userRecord, profile] = await Promise.all([
          db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1),
          db
            .select({ id: studentProfiles.id })
            .from(studentProfiles)
            .where(eq(studentProfiles.userId, userId))
            .limit(1),
        ]);

        token.sub = userId;
        token.role = userRecord[0]?.role ?? user?.role ?? "STUDENT";
        token.hasCompletedProfile = profile.length > 0;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        const role = token.role === "ADMIN" ? "ADMIN" : "STUDENT";
        const hasCompletedProfile = token.hasCompletedProfile === true;

        session.user.id = token.sub;
        session.user.role = role;
        session.user.hasCompletedProfile = hasCompletedProfile;
      }
      return session;
    },
  },
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

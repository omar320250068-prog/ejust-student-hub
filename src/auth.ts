import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studentProfiles, users } from "@/db/schema";
import { recordAuthError } from "@/lib/auth-error-store";
import { resolveMeritTier, type MeritTier } from "@/lib/merit";
import type { TaStatus } from "@/types/next-auth";

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
            .select({
              role: users.role,
              taStatus: users.taStatus,
              meritPoints: users.meritPoints,
              meritTierOverride: users.meritTierOverride,
            })
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
        token.taStatus = userRecord[0]?.taStatus ?? user?.taStatus ?? "NONE";
        token.meritPoints = userRecord[0]?.meritPoints ?? 0;
        token.meritTierOverride = userRecord[0]?.meritTierOverride ?? null;
        token.hasCompletedProfile = profile.length > 0;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        const role =
          token.role === "ADMIN"
            ? "ADMIN"
            : token.role === "TA"
              ? "TA"
              : "STUDENT";
        const hasCompletedProfile = token.hasCompletedProfile === true;
        const meritPoints =
          typeof token.meritPoints === "number" ? token.meritPoints : 0;
        const meritTierOverride = (
          ["EXPLORER", "PEER_HELPER", "CAMPUS_AMBASSADOR", "EJUST_MENTOR"] as const
        ).includes(token.meritTierOverride as never)
          ? (token.meritTierOverride as MeritTier)
          : null;
        const taStatus = (
          ["NONE", "PENDING", "APPROVED", "REJECTED"] as const
        ).includes(token.taStatus as never)
          ? (token.taStatus as TaStatus)
          : "NONE";
        const meritTier = resolveMeritTier(meritPoints, meritTierOverride);

        session.user.id = token.sub;
        session.user.role = role;
        session.user.taStatus = taStatus;
        session.user.meritPoints = meritPoints;
        session.user.meritTier = meritTier;
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

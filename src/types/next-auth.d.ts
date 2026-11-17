import type { DefaultSession } from "next-auth";

export type UserRole = "STUDENT" | "ADMIN" | "TA";
export type TaStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";
export type MeritTier =
  | "EXPLORER"
  | "PEER_HELPER"
  | "CAMPUS_AMBASSADOR"
  | "EJUST_MENTOR";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      taStatus: TaStatus;
      meritTier: MeritTier;
      meritPoints: number;
      hasCompletedProfile: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    taStatus?: TaStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    taStatus?: TaStatus;
    meritPoints?: number;
    meritTierOverride?: MeritTier | null;
    hasCompletedProfile?: boolean;
  }
}

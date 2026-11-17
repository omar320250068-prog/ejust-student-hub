export type MeritTier =
  | "EXPLORER"
  | "PEER_HELPER"
  | "CAMPUS_AMBASSADOR"
  | "EJUST_MENTOR";

export const MERIT_TIERS: {
  tier: MeritTier;
  min: number;
  max: number | null;
  label: string;
  labelAr: string;
  perks: string;
}[] = [
  {
    tier: "EXPLORER",
    min: 0,
    max: 29,
    label: "Explorer",
    labelAr: "مستكشف",
    perks: "Can browse campus knowledge and ask the assistant.",
  },
  {
    tier: "PEER_HELPER",
    min: 30,
    max: 99,
    label: "Peer Helper",
    labelAr: "مساعد زملاء",
    perks: "Can answer other students' escalated questions (pending admin verification).",
  },
  {
    tier: "CAMPUS_AMBASSADOR",
    min: 100,
    max: 249,
    label: "Campus Ambassador",
    labelAr: "سفير الحرم الجامعي",
    perks: "Peer answers get priority in the admin queue and count double on verification.",
  },
  {
    tier: "EJUST_MENTOR",
    min: 250,
    max: null,
    label: "EJUST Mentor",
    labelAr: "مرشد الجامعة",
    perks: "Trusted contributor badge; peer answers are highlighted to admins.",
  },
];

export function tierForPoints(points: number): MeritTier {
  if (points >= 250) return "EJUST_MENTOR";
  if (points >= 100) return "CAMPUS_AMBASSADOR";
  if (points >= 30) return "PEER_HELPER";
  return "EXPLORER";
}

export function resolveMeritTier(
  points: number,
  override: MeritTier | null | undefined
): MeritTier {
  return override ?? tierForPoints(points);
}

export function tierMeta(tier: MeritTier) {
  return MERIT_TIERS.find((entry) => entry.tier === tier)!;
}

export const TIER_RANK: Record<MeritTier, number> = {
  EXPLORER: 0,
  PEER_HELPER: 1,
  CAMPUS_AMBASSADOR: 2,
  EJUST_MENTOR: 3,
};

/** Merit awarded per qualifying action, in points. */
export const MERIT_AWARDS = {
  scholarshipApproved: 25,
  peerAnswerVerified: 15,
  faqApproved: 10,
  scheduleUpdateApproved: 10,
} as const;

export type MeritAwardReason = keyof typeof MERIT_AWARDS;

/**
 * Daily assistant quota per tier.
 *
 * Staff (`TA` with an approved application, and `ADMIN`) are not throttled by
 * merit: their access comes from the role, not from contributor points.
 */
export const DAILY_AI_QUOTA: Record<MeritTier, number> = {
  EXPLORER: 10,
  PEER_HELPER: 30,
  CAMPUS_AMBASSADOR: 60,
  EJUST_MENTOR: 150,
};

export const STAFF_AI_QUOTA = 500;

export function atLeast(tier: MeritTier, min: MeritTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}

export function canPeerAnswer(tier: MeritTier | undefined): boolean {
  return tier ? atLeast(tier, "PEER_HELPER") : false;
}

export function canSubmitScholarship(tier: MeritTier | undefined): boolean {
  return tier ? atLeast(tier, "CAMPUS_AMBASSADOR") : false;
}

export function canAttachResources(tier: MeritTier | undefined): boolean {
  return tier ? atLeast(tier, "CAMPUS_AMBASSADOR") : false;
}

export function canAutoApprove(tier: MeritTier | undefined): boolean {
  return tier ? tier === "EJUST_MENTOR" : false;
}

export function dailyAiQuota(tier: MeritTier | undefined): number {
  return tier ? DAILY_AI_QUOTA[tier] : DAILY_AI_QUOTA.EXPLORER;
}

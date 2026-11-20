/**
 * Account type selected by the user during sign-up. It is never inferred from
 * the email address: an email string is spoofable and cannot grant staff access.
 */
export type AccountType = "STUDENT" | "TA";

/** A missing selection defaults to STUDENT; anything else is rejected. */
export function parseAccountType(value: unknown): AccountType | null {
  if (value === undefined || value === null) return "STUDENT";
  if (value === "STUDENT" || value === "TA") return value;
  return null;
}

export interface RegistrationRoleFields {
  role: AccountType;
  taStatus: "NONE" | "PENDING";
  taAppliedAt?: Date;
}

/**
 * TAs enter the existing admin approval queue: `role = TA` drives the TA
 * onboarding flow, while staff tools stay gated until `taStatus = APPROVED`.
 */
export function registrationRoleFields(accountType: AccountType): RegistrationRoleFields {
  if (accountType === "TA") {
    return { role: "TA", taStatus: "PENDING", taAppliedAt: new Date() };
  }
  return { role: "STUDENT", taStatus: "NONE" };
}

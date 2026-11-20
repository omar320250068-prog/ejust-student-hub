/** Shared password rules for registration and password reset. */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;

export type PasswordValidation = "ok" | "too_short" | "too_long";

/** bcrypt truncates after 72 bytes, so reject longer inputs explicitly. */
export function validatePassword(value: unknown): PasswordValidation {
  if (typeof value !== "string") return "too_short";
  if (value.length < MIN_PASSWORD_LENGTH) return "too_short";
  if (new TextEncoder().encode(value).length > MAX_PASSWORD_BYTES) return "too_long";
  return "ok";
}

/** Type-narrowing form for route handlers that pass the result to bcrypt. */
export function isPasswordValid(value: unknown): value is string {
  return validatePassword(value) === "ok";
}

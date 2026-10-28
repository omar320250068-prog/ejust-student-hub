"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  Configuration:
    "The server's sign-in provider is misconfigured (missing or invalid credentials). Check the server logs.",
  AccessDenied: "You cancelled the sign-in or access was denied.",
  Verification: "That sign-in link has expired or was already used.",
  OAuthCallback: "The provider returned an error while signing you in.",
  OAuthCallbackError: "The provider returned an error while signing you in.",
  OAuthAccountNotLinked:
    "This email is already registered with a different sign-in method. Sign in the way you originally did.",
  CallbackRouteError:
    "The sign-in callback failed. Usually the redirect URI or client secret does not match the provider console.",
  InvalidCheck: "Your sign-in session expired. Please try again.",
  MissingSecret: "AUTH_SECRET is not set on the server.",
  UntrustedHost: "The server does not trust this host.",
  CredentialsSignin: "Invalid email or password.",
};

export default function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "Configuration";
  const message = MESSAGES[error] ?? "An unknown sign-in error occurred.";

  return (
    <>
      <p className="text-sm opacity-70">
        Error code: <code className="font-mono">{error}</code>
      </p>
      <p className="text-base">{message}</p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Try again
        </Link>
        <Link
          href="/"
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Home
        </Link>
      </div>
    </>
  );
}

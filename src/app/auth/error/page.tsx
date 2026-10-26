"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const MESSAGES: Record<string, string> = {
  Configuration:
    "The server's Google OAuth credentials are missing or invalid (unknown client, wrong secret, or a malformed URL). Check the server logs.",
  AccessDenied: "You cancelled the Google sign-in or access was denied.",
  Verification: "That sign-in link has expired or was already used.",
  OAuthCallback: "Google returned an error while signing you in.",
  OAuthCallbackError: "Google returned an error while signing you in.",
  OAuthAccountNotLinked:
    "This email is already linked to a different sign-in method.",
  CallbackRouteError:
    "The sign-in callback failed. Usually this means the redirect URI or client secret does not match Google Cloud Console.",
  InvalidCheck: "Your sign-in session expired. Please try again.",
  MissingSecret: "AUTH_SECRET is not set on the server.",
  UntrustedHost: "The server does not trust this host.",
};

export default function AuthErrorPage() {
  const [error, setError] = useState("Configuration");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("error");
    if (value) setError(value);
  }, []);

  const message = MESSAGES[error] ?? "An unknown sign-in error occurred.";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Sign-in failed</h1>
      <p className="text-sm opacity-70">
        Error code: <code className="font-mono">{error}</code>
      </p>
      <p className="text-base">{message}</p>
      <div className="flex gap-3">
        <Link
          href="/contribute"
          className="rounded-md border px-4 py-2 text-sm hover:bg-white/5"
        >
          Try again
        </Link>
        <Link
          href="/"
          className="rounded-md border px-4 py-2 text-sm hover:bg-white/5"
        >
          Home
        </Link>
      </div>
    </main>
  );
}

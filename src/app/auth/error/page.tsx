import { Suspense } from "react";
import AuthErrorContent from "./error-content";

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Sign-in failed</h1>
      <Suspense fallback={<p className="text-sm opacity-70">Reading error details…</p>}>
        <AuthErrorContent />
      </Suspense>
    </main>
  );
}

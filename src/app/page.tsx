import { Suspense } from "react";
import { connection } from "next/server";
import { auth } from "@/auth";
import MasterPlan from "@/components/MasterPlan";
import PublicLanding from "@/components/PublicLanding";

/**
 * The landing shell is public and prerenderable. The session read is deferred
 * behind Suspense so Cache Components can stream in the signed-in dashboard.
 */
async function SessionHome() {
  // Session decoding uses WebCrypto randomness, so defer it to request time.
  await connection();
  const session = await auth();
  return session ? <MasterPlan /> : <PublicLanding />;
}

export default function Home() {
  return (
    <Suspense fallback={<PublicLanding />}>
      <SessionHome />
    </Suspense>
  );
}

import { Suspense } from "react";
import CampusMapPage from "@/components/CampusMapPage";

export default function MapRoute() {
  return (
    <Suspense
      fallback={
        <main className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center bg-slate-950 text-slate-300">
          <p className="text-sm tracking-wide">E-JUST / CAMPUS MAP…</p>
        </main>
      }
    >
      <CampusMapPage />
    </Suspense>
  );
}

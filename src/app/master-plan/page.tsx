import { Suspense } from "react";
import MasterPlan from "@/components/MasterPlan";
import FreeRoomsPanel from "@/components/FreeRoomsPanel";
import { parseMasterPlanLocation } from "@/lib/master-plan-inspector";

type MasterPlanSearchParams = {
  building?: string | string[];
  room?: string | string[];
  tab?: string | string[];
  office?: string | string[];
  q?: string | string[];
};

/**
 * Signed-in alias for the campus master plan with the Free Rooms Finder
 * alongside it. The root route keeps the guest landing / master-plan split.
 */
async function MasterPlanContent({
  searchParams,
}: {
  searchParams: Promise<MasterPlanSearchParams>;
}) {
  const params = await searchParams;
  const initial = parseMasterPlanLocation(params);
  const initialFilter = [initial.building, initial.room].filter(Boolean).join(" ");

  return (
    <main className="min-h-[calc(100vh-3rem)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <MasterPlan
        key={`${initial.building}|${initial.tab}|${initial.room}|${initial.office}|${initial.q}`}
        initialBuilding={initial.building}
        initialTab={initial.tab}
        initialRoom={initial.room}
        initialOffice={initial.office}
        initialQ={initial.q}
      />
      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <FreeRoomsPanel key={initialFilter} initialFilter={initialFilter} />
      </div>
    </main>
  );
}

export default function MasterPlanRoute({
  searchParams,
}: {
  searchParams: Promise<MasterPlanSearchParams>;
}) {
  return (
    <Suspense fallback={null}>
      <MasterPlanContent searchParams={searchParams} />
    </Suspense>
  );
}

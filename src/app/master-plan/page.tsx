import { Suspense } from "react";
import MasterPlan from "@/components/MasterPlan";
import FreeRoomsPanel from "@/components/FreeRoomsPanel";

type MasterPlanSearchParams = {
  building?: string | string[];
  room?: string | string[];
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
  const first = (value?: string | string[]) =>
    Array.isArray(value) ? value[0] : value;
  const building = first(params.building)?.trim() ?? "";
  const room = first(params.room)?.trim() ?? "";
  const initialFilter = [building, room].filter(Boolean).join(" ");

  return (
    <main className="min-h-[calc(100vh-3rem)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <MasterPlan />
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

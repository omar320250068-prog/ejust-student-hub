import { redirect } from "next/navigation";

/** The GPS map is retired; send old links to the master plan + room finder. */
export default function MapRoute() {
  redirect("/master-plan");
}

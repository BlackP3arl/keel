import type { Metadata } from "next";
import { WorkloadView } from "@/components/workload-view";

export const metadata: Metadata = { title: "Workload" };

export default function Page() {
  return <WorkloadView />;
}

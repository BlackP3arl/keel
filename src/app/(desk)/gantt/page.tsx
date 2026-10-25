import type { Metadata } from "next";
import { GanttView } from "@/components/gantt-view";

export const metadata: Metadata = { title: "Timeline" };

export default function Page() {
  return <GanttView />;
}

import type { Metadata } from "next";
import { TaskTable } from "@/components/task-table";

export const metadata: Metadata = { title: "Tasks" };

export default function Page() {
  return <TaskTable />;
}

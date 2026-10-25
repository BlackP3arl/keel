import type { Metadata } from "next";
import { KanbanView } from "@/components/kanban-view";

export const metadata: Metadata = { title: "Kanban" };

export default function Page() {
  return <KanbanView />;
}

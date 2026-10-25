import { Suspense } from "react";
import { ProjectDetail } from "@/components/project-detail";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Opening project…</p>}>
      <ProjectDetail />
    </Suspense>
  );
}

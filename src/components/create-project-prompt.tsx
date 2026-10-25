"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ProjectDialog } from "@/components/editors";
import { EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useDesk } from "@/lib/store";

export function CreateProjectPrompt({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  const desk = useDesk();

  return (
    <>
      <EmptyState
        title="No projects yet"
        body={body}
        action={
          desk.canWrite ? (
            <Button onClick={() => setOpen(true)}>
              <Plus />
              New project
            </Button>
          ) : undefined
        }
      />
      <ProjectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

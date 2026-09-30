"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ProjectDialog } from "@/components/editors";
import { EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export function CreateProjectPrompt({ body }: { body: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <EmptyState
        title="No projects yet"
        body={body}
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus />
            New project
          </Button>
        }
      />
      <ProjectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

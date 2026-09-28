"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DeskProvider } from "@/lib/store";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <DeskProvider>
        <AppShell>{children}</AppShell>
        <Toaster theme="dark" />
      </DeskProvider>
    </TooltipProvider>
  );
}

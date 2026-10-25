"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { DeskProvider } from "@/lib/store";

export function DeskShell({ children }: { children: ReactNode }) {
  return (
    <DeskProvider>
      <AppShell>{children}</AppShell>
    </DeskProvider>
  );
}

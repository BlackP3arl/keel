"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider>
        {children}
        <Toaster theme="dark" />
      </TooltipProvider>
    </SessionProvider>
  );
}

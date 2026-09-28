"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ChartGantt,
  Columns3,
  LayoutDashboard,
  ListChecks,
  Menu,
  RotateCcw,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useDesk } from "@/lib/store";
import { cn } from "cn";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kanban", label: "Kanban", icon: Columns3 },
  { href: "/gantt", label: "Timeline", icon: ChartGantt },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/workload", label: "Workload", icon: Users },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1" aria-label="Desk">
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              active && "bg-sidebar-accent font-medium text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="block">
      <span className="font-heading text-xl tracking-tight">Keel</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">Delivery desk</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const desk = useDesk();
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <div className="flex h-dvh bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="px-4 py-4">
          <Brand />
        </div>
        <div className="px-2">
          <NavLinks />
        </div>
        <div className="mt-auto px-4 py-4">
          <Separator className="mb-3" />
          <p className="text-xs text-muted-foreground">
            {desk.developers.length} people on the IT roster. Saved in this browser.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 -ml-2"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw />
            Reset demo data
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted"
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar">
              <SheetHeader>
                <SheetTitle className="font-heading text-xl">Keel</SheetTitle>
              </SheetHeader>
              <div className="px-2">
                <NavLinks onNavigate={() => setMenuOpen(false)} />
              </div>
              <div className="mt-auto px-4 pb-4">
                <p className="text-xs text-muted-foreground">
                  {desk.developers.length} people on the IT roster. Saved in this browser.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 -ml-2"
                  onClick={() => {
                    setMenuOpen(false);
                    setResetOpen(true);
                  }}
                >
                  <RotateCcw />
                  Reset demo data
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Brand />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
          {desk.ready ? (
            children
          ) : (
            <p className="text-sm text-muted-foreground">Opening the delivery desk…</p>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset the sample desk?"
        body="This replaces projects, tasks, and the roster with the original sample. Edits saved in this browser will be lost."
        confirmLabel="Reset"
        onConfirm={() => {
          desk.resetDesk();
          setResetOpen(false);
          toast("Sample desk restored.");
        }}
      />
    </div>
  );
}

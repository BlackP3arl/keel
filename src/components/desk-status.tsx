"use client";

import { useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Download, LogOut, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDesk } from "@/lib/store";

function downloadJson(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DeskBanners() {
  const desk = useDesk();

  if (!desk.loadError && !desk.saveError) return null;

  return (
    <div className="grid gap-2 pb-4">
      {desk.loadError ? (
        <div
          role="alert"
          data-testid="load-error"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Could not load the desk from the server. Changes will not be saved, so stored data is left as it is.{" "}
          {desk.loadError}
        </div>
      ) : null}
      {desk.saveError ? (
        <div
          role="alert"
          data-testid="save-error"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <p>Could not save the desk. {desk.saveError}</p>
          <Button variant="outline" size="sm" onClick={() => desk.retrySave()} data-testid="retry-save">
            Retry save
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function LocalImportDialog() {
  const desk = useDesk();
  const local = desk.pendingLocalImport;
  const open = local !== null;

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && desk.dismissLocalImport()}>
      <AlertDialogContent className="sm:max-w-md" data-testid="local-import-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Import this browser’s desk?</AlertDialogTitle>
          <AlertDialogDescription>
            {local
              ? `This browser still has a local copy with ${local.projects.length} projects and ${local.tasks.length} tasks. The server desk is empty. Import it so the work is not lost.`
              : "This browser has a local desk."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => desk.dismissLocalImport()}>Not now</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            onClick={() => {
              const result = desk.importLocalDesk();
              if (!result.ok) toast.error(result.reason);
              else toast.success("Imported the local desk to the server.");
            }}
          >
            Import
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeskAccount() {
  const desk = useDesk();
  const session = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmImport, setConfirmImport] = useState<string | null>(null);
  const email = session.data?.user?.email ?? "";

  function onExport() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`keel-desk-${stamp}.json`, desk.exportJson());
  }

  function onPickFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      setConfirmImport(raw);
    };
    reader.readAsText(file);
  }

  return (
    <div className="grid gap-2 text-xs text-muted-foreground">
      <p>
        {desk.developers.length} people on the IT roster.
        {desk.saving ? " Saving…" : desk.saveError ? " Save failed." : " Saved on the server."}
      </p>
      {email ? <p className="truncate" title={email}>{email}</p> : null}
      <div className="flex flex-wrap gap-1">
        <Button variant="ghost" size="xs" onClick={onExport} data-testid="export-json">
          <Download />
          Export
        </Button>
        <Button variant="ghost" size="xs" onClick={() => fileRef.current?.click()} data-testid="import-json">
          <Upload />
          Import
        </Button>
        <Button variant="ghost" size="xs" onClick={() => void signOut({ callbackUrl: "/login" })}>
          <LogOut />
          Sign out
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        data-testid="import-json-file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          onPickFile(file);
        }}
      />
      <AlertDialog open={confirmImport !== null} onOpenChange={(open) => !open && setConfirmImport(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the server desk?</AlertDialogTitle>
            <AlertDialogDescription>
              Importing JSON overwrites projects, tasks, comments, and the roster on the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              onClick={() => {
                if (confirmImport == null) return;
                const result = desk.importJson(confirmImport);
                setConfirmImport(null);
                if (!result.ok) toast.error(result.reason);
                else toast.success("Imported the JSON desk.");
              }}
            >
              Replace desk
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

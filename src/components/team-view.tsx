"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, PageHeader } from "@/components/page-header";
import { LabeledSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEPARTMENTS } from "@/lib/labels";
import { useDesk } from "@/lib/store";
import type { Department, Developer, Project, Task } from "@/lib/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      {children}
    </div>
  );
}

function removalBody(name: string, owned: Project[], assigned: Task[]): string {
  if (owned.length === 0 && assigned.length === 0) {
    return `${name} is not an owner or an assignee. They will be removed from the roster.`;
  }
  const parts: string[] = [];
  if (owned.length === 1) parts.push(`owns ${owned[0].name}`);
  else if (owned.length > 1) parts.push(`owns ${owned.length} projects, including ${owned[0].name}`);
  if (assigned.length === 1) parts.push(`is assigned ${assigned[0].title}`);
  else if (assigned.length > 1) parts.push(`is assigned ${assigned.length} tasks, including ${assigned[0].title}`);
  return `${name} ${parts.join(" and ")}. Removing them clears those assignments.`;
}

export function TeamView() {
  const desk = useDesk();
  const [editing, setEditing] = useState<Developer | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div data-testid="team">
      <PageHeader
        title="Team"
        lede="The IT roster. Add someone and they can own a project or take a task. Removing a person clears those assignments."
        action={
          desk.canWrite ? (
            <Button onClick={() => setCreating(true)} data-testid="new-person">
              <Plus />
              Add person
            </Button>
          ) : undefined
        }
      />
      {desk.developers.length === 0 ? (
        <EmptyState
          title="No one on the roster"
          body="Add the first person so projects and tasks have someone to assign."
          action={
            desk.canWrite ? (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                Add person
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {desk.developers.map((person) => (
                <TableRow
                  key={person.id}
                  data-testid="team-row"
                  data-developer-id={person.id}
                  className={desk.canWrite ? "cursor-pointer" : undefined}
                  onClick={() => {
                    if (desk.canWrite) setEditing(person);
                  }}
                >
                  <TableCell className="font-medium">{person.name}</TableCell>
                  <TableCell>{person.role || "—"}</TableCell>
                  <TableCell>{person.department}</TableCell>
                  <TableCell className={person.email ? undefined : "text-muted-foreground"}>{person.email || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PersonDialog open={creating} onOpenChange={setCreating} />
      <PersonDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} person={editing} />
    </div>
  );
}

function PersonDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: Developer | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? <PersonForm person={person ?? null} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PersonForm({ person, onClose }: { person: Developer | null; onClose: () => void }) {
  const desk = useDesk();
  const [name, setName] = useState(person?.name ?? "");
  const [role, setRole] = useState(person?.role ?? "");
  const [department, setDepartment] = useState<Department>(person?.department ?? "IT");
  const [email, setEmail] = useState(person?.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const owned = person ? desk.projects.filter((project) => project.ownerId === person.id) : [];
  const assigned = person ? desk.tasks.filter((task) => task.assigneeId === person.id) : [];

  function save() {
    const input = { name, role, department, email };
    const result = person ? desk.updateDeveloper(person.id, input) : desk.createDeveloper(input);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    toast(person ? "Person updated." : "Person added.");
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{person ? "Edit person" : "Add person"}</DialogTitle>
        <DialogDescription>
          Name is required. Designation, department, and email are stored with the roster. Leave email blank if you do not have one yet.
        </DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} required data-testid="person-name" />
        </Field>
        <Field label="Designation">
          <Input value={role} onChange={(event) => setRole(event.target.value)} data-testid="person-role" />
        </Field>
        <LabeledSelect
          label="Department"
          value={department}
          onValueChange={(next) => setDepartment(next as Department)}
          options={DEPARTMENTS.map((item) => ({ value: item, label: item }))}
          testId="person-department"
          full
        />
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            data-testid="person-email"
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="sm:justify-between">
          {person ? (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)} data-testid="person-delete">
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" data-testid="person-save">
              {person ? "Save" : "Add person"}
            </Button>
          </div>
        </DialogFooter>
      </form>
      {person ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Remove ${person.name}?`}
          body={removalBody(person.name, owned, assigned)}
          confirmLabel="Remove person"
          onConfirm={() => {
            const result = desk.deleteDeveloper(person.id);
            if (!result.ok) {
              setError(result.reason);
              setConfirmDelete(false);
              return;
            }
            toast("Person removed.");
            onClose();
          }}
        />
      ) : null}
    </>
  );
}

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, PageHeader } from "@/components/page-header";
import { LabeledSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ManagedUser } from "@/lib/access";
import { APP_ROLE_LABEL, APP_ROLES, type AppRole } from "@/lib/roles";
import { cn } from "cn";

const ROLE_OPTIONS = APP_ROLES.map((role) => ({ value: role, label: APP_ROLE_LABEL[role] }));

function RoleBadge({ role, bootstrap }: { role: AppRole; bootstrap?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge
        variant="outline"
        data-role={role}
        className={cn(
          "h-5",
          role === "admin"
            ? "border-[#2dd4bf]/45 bg-[#2dd4bf]/15 text-[#5eead4]"
            : "border-[#2e303a] bg-[#22242c] text-[#9ca3af]",
        )}
      >
        {APP_ROLE_LABEL[role]}
      </Badge>
      {bootstrap ? <span className="text-xs text-muted-foreground">Bootstrap</span> : null}
    </span>
  );
}

export function UsersView({
  initialUsers,
  initialError,
}: {
  initialUsers: ManagedUser[];
  initialError: string | null;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState(initialError);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<ManagedUser | null>(null);

  async function addUser() {
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; users?: ManagedUser[] } | null;
      if (!res.ok) {
        toast.error(body?.error ?? "Could not add that user.");
        return;
      }
      setUsers(body?.users ?? []);
      setError(null);
      setEmail("");
      setRole("viewer");
      toast.success("User added.");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(target: ManagedUser, nextRole: AppRole) {
    if (target.role === nextRole) return;
    const res = await fetch(`/api/users/${encodeURIComponent(target.email)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    const body = (await res.json().catch(() => null)) as { error?: string; users?: ManagedUser[] } | null;
    if (!res.ok) {
      toast.error(body?.error ?? "Could not change that role.");
      return;
    }
    setUsers(body?.users ?? []);
    toast(`${target.email} is now ${APP_ROLE_LABEL[nextRole]}.`);
  }

  async function removeUser(target: ManagedUser) {
    const res = await fetch(`/api/users/${encodeURIComponent(target.email)}`, { method: "DELETE" });
    const body = (await res.json().catch(() => null)) as { error?: string; users?: ManagedUser[] } | null;
    if (!res.ok) {
      toast.error(body?.error ?? "Could not remove that user.");
      return;
    }
    setUsers(body?.users ?? []);
    toast(`${target.email} was removed.`);
  }

  return (
    <div data-testid="users">
      <PageHeader
        title="Users"
        lede="Authorize Google accounts to use this shared desk. Admins can edit. Viewers can only look. Emails in ALLOWED_EMAILS stay admins and cannot be locked out."
      />

      <form
        className="mb-5 flex flex-wrap items-end gap-3"
        data-testid="add-user-form"
        onSubmit={(event) => {
          event.preventDefault();
          void addUser();
        }}
      >
        <label className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Google email</span>
          <Input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@gmail.com"
            className="w-full sm:w-72"
            data-testid="user-email"
          />
        </label>
        <LabeledSelect
          label="Role"
          value={role}
          onValueChange={(next) => setRole(next as AppRole)}
          options={ROLE_OPTIONS}
          testId="user-role"
        />
        <Button type="submit" disabled={saving} data-testid="add-user">
          <Plus />
          Add user
        </Button>
      </form>

      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {users.length === 0 ? (
        <EmptyState title="No users yet" body="Add a Google email, or sign in with a bootstrap admin from ALLOWED_EMAILS." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.email} data-testid="user-row" data-email={user.email} data-role={user.role}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    {user.bootstrap ? (
                      <RoleBadge role={user.role} bootstrap />
                    ) : (
                      <LabeledSelect
                        label="Role"
                        hideLabel
                        value={user.role}
                        onValueChange={(next) => void changeRole(user, next as AppRole)}
                        options={ROLE_OPTIONS}
                        testId={`user-role-${user.email}`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.bootstrap ? (
                      <span className="text-xs text-muted-foreground">Protected</span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`remove-user-${user.email}`}
                        onClick={() => setRemoving(user)}
                      >
                        Remove
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? `Remove ${removing.email}?` : "Remove user?"}
        body="They will no longer be able to sign in, unless they are also listed in ALLOWED_EMAILS."
        confirmLabel="Remove user"
        onConfirm={() => {
          if (!removing) return;
          const target = removing;
          setRemoving(null);
          void removeUser(target);
        }}
      />
    </div>
  );
}

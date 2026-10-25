import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { EmptyState } from "@/components/page-header";
import { UsersView } from "@/components/users-view";
import { buttonVariants } from "@/components/ui/button";
import { resolveSessionAccess, mergeManagedUsers } from "@/lib/access";
import { listStoredUsers } from "@/lib/users";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  const access = await resolveSessionAccess(session?.user?.email);
  if (!access.ok || access.role !== "admin") {
    return (
      <EmptyState
        title="Admins only"
        body="User management is limited to admins. Viewers can still read the shared desk."
        action={
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back to the desk
          </Link>
        }
      />
    );
  }

  let users;
  let error: string | null = null;
  try {
    users = mergeManagedUsers(await listStoredUsers());
  } catch (caught) {
    users = [];
    error = caught instanceof Error ? caught.message : "Users could not be loaded.";
  }

  return <UsersView initialUsers={users} initialError={error} />;
}

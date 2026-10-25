import { deleteUser, patchUser } from "@/lib/users-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ email: string }> }) {
  const { email } = await context.params;
  return patchUser(decodeURIComponent(email), request);
}

export async function DELETE(_request: Request, context: { params: Promise<{ email: string }> }) {
  const { email } = await context.params;
  return deleteUser(decodeURIComponent(email));
}

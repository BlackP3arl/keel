import { getUsers, postUser } from "@/lib/users-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return getUsers();
}

export async function POST(request: Request) {
  return postUser(request);
}

import { getDesk, putDesk } from "@/lib/desk-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return getDesk();
}

export async function PUT(request: Request) {
  return putDesk(request);
}

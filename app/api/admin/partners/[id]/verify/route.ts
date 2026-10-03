import { NextRequest } from "next/server";
import { reviewPartner } from "@/lib/admin-review";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return reviewPartner(request, "application", (await context.params).id);
}

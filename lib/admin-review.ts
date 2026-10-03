import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from "@/lib/supabase-config";
import { getServiceClient } from "@/lib/supabase-admin";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
export const reviewResponse = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function reviewPartner(
  request: Request,
  kind: "application" | "document",
  applicationId?: string,
) {
  try {
    const bearer = /^Bearer\s+(\S+)$/i.exec(
      request.headers.get("authorization") ?? "",
    );
    if (!bearer)
      return reviewResponse({ error: "Authentication required." }, 401);
    const client = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
      global: { headers: { Authorization: "Bearer " + bearer[1] } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error,
    } = await client.auth.getUser(bearer[1]);
    if (error || !user)
      return reviewResponse({ error: "Authentication required." }, 401);
    const { data: profile, error: roleError } = await client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (roleError || profile?.role !== "admin")
      return reviewResponse({ error: "Admin access required." }, 403);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return reviewResponse({ error: "Invalid review request." }, 400);
    const id = kind === "application" ? applicationId : body.id;
    const action = kind === "application" ? body.action : body.status;
    const allowed =
      kind === "application"
        ? ["approve", "reject", "suspend"]
        : ["approved", "rejected"];
    const expected = body.expected_status ?? "pending"; // Existing pending-queue callers remain supported.
    const reason =
      body.rejection_reason ??
      (action === "reject"
        ? "Application requires correction."
        : action === "rejected"
          ? "Document requires correction."
          : "");
    if (
      typeof id !== "string" ||
      !uuid.test(id) ||
      !allowed.includes(action) ||
      !["pending", "approved", "rejected", "suspended"].includes(expected) ||
      typeof reason !== "string" ||
      reason.length > 500
    ) {
      return reviewResponse({ error: "Invalid review details." }, 400);
    }
    const { data, error: rpcError } = await getServiceClient().rpc(
      kind === "application"
        ? "partner_review_application_v1"
        : "partner_review_document_v1",
      {
        p_actor: user.id,
        p_id: id,
        ...(kind === "application"
          ? { p_action: action }
          : { p_status: action }),
        p_expected: expected,
        p_reason: reason,
      },
    );
    if (rpcError) {
      if (["22023", "40001", "42501", "P0002"].includes(rpcError.code)) {
        return reviewResponse(
          { error: rpcError.message },
          (
            { "22023": 400, "40001": 409, "42501": 403, P0002: 404 } as Record<
              string,
              number
            >
          )[rpcError.code],
        );
      }
      if (["PGRST202", "42883"].includes(rpcError.code))
        return reviewResponse(
          { error: "Approval update is not installed yet. Contact support." },
          503,
        );
      console.error("Partner review failed", rpcError.code);
      return reviewResponse(
        { error: "Review could not be saved. Refresh and try again." },
        500,
      );
    }
    if (!data?.id || !data?.status)
      return reviewResponse(
        { error: "Review result could not be verified. Refresh the page." },
        500,
      );
    return reviewResponse({ [kind]: data });
  } catch {
    return reviewResponse(
      { error: "Unable to save review. Check your connection and try again." },
      500,
    );
  }
}

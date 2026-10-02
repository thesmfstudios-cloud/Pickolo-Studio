import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase-admin";
import { writeAdminAudit } from "@/lib/admin-audit";
import {
  adminAccess,
  adminBody,
  adminFailure,
  adminJson,
  AdminError,
  requireUuid,
  rpcFailure,
} from "@/lib/admin-access";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function adminClient(request: NextRequest) {
  if (!url || !anonKey)
    throw new Error("Supabase environment is not configured.");
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(url, anonKey, {
    global: authorization
      ? { headers: { Authorization: authorization } }
      : undefined,
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = adminClient(request);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user)
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    const { data: role } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (role?.role !== "admin")
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );

    const status = request.nextUrl.searchParams.get("status");
    const serviceClient = getServiceClient();
    let query = serviceClient
      .from("booking_disputes")
      .select(
        "id,booking_id,opened_by,reason_code,description,status,resolution,resolved_by,resolved_at,created_at",
      )
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error: listError } = await query;
    if (listError)
      return NextResponse.json({ error: listError.message }, { status: 400 });
    return NextResponse.json({ disputes: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load disputes.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, client } = await adminAccess(request),
      body = await adminBody(request),
      id = requireUuid(body.id);
    if (!["under_review", "resolved", "rejected"].includes(String(body.status)))
      throw new AdminError("Choose a valid support status.");
    const result = await client.rpc("admin_review_dispute", {
      p_actor: user.id,
      p_id: id,
      p_status: body.status,
      p_expected: body.expected_status,
      p_resolution:
        typeof body.resolution === "string" ? body.resolution.trim() : "",
    });
    if (result.error) rpcFailure(result.error);
    return adminJson({ dispute: result.data });
  } catch (error) {
    return adminFailure(error);
  }
}

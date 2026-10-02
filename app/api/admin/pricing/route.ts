import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

function getClient(request: NextRequest) {
  if (!url || !anonKey)
    throw new Error("Supabase environment is not configured.");
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(url, anonKey, {
    global: authorization
      ? { headers: { Authorization: authorization } }
      : undefined,
  });
}

async function requireAdmin(request: NextRequest) {
  const supabase = getClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { supabase, user: null };
  return { supabase, user };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAdmin(request);
    if (!user)
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );

    const { data, error } = await supabase
      .from("service_level_prices")
      .select(
        "id,service_level_id,duration_minutes,amount_paise,platform_fee_bps,active,updated_at,service_level:service_levels(id,name)",
      )
      .order("service_level_id")
      .order("duration_minutes");

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ pricing: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, client } = await adminAccess(request),
      body = await adminBody(request),
      id = requireUuid(body.id);
    const amount = Number(body.amount_paise),
      fee = Number(body.platform_fee_bps);
    if (
      !Number.isSafeInteger(amount) ||
      amount < 100 ||
      amount > 100000000 ||
      !Number.isInteger(fee) ||
      fee < 0 ||
      fee > 10000 ||
      typeof body.expected_updated_at !== "string" ||
      !Number.isFinite(Date.parse(body.expected_updated_at))
    )
      throw new AdminError(
        "Valid pricing, fee and last-update time are required.",
      );
    const result = await client.rpc("admin_update_price", {
      p_actor: user.id,
      p_id: id,
      p_amount: amount,
      p_fee: fee,
      p_expected: body.expected_updated_at,
    });
    if (result.error) rpcFailure(result.error);
    return adminJson({ pricing: result.data });
  } catch (error) {
    return adminFailure(error);
  }
}

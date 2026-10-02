import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-admin";

export class AdminError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

// The database role is authoritative. Never authorize from user-editable metadata.
export async function adminAccess(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new AdminError("Admin connection is not configured.", 503);
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/i.test(authorization))
    throw new AdminError("Please sign in again.", 401);
  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new AdminError("Please sign in again.", 401);
  const profile = await client
    .from("profiles")
    .select("role,full_name")
    .eq("id", user.id)
    .single();
  if (profile.error)
    throw new AdminError(
      "Unable to verify operator access. Retry shortly.",
      503,
    );
  if (profile.data?.role !== "admin")
    throw new AdminError("This account does not have admin access.", 403);
  return { user, profile: profile.data, client: getServiceClient() };
}

export function adminJson(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
}

export function adminFailure(error: unknown) {
  if (error instanceof AdminError)
    return adminJson({ error: error.message }, error.status);
  return adminJson(
    { error: "The operation could not be completed. Refresh and retry." },
    500,
  );
}

export function rpcFailure(error: { code?: string; message?: string }) {
  if (["PGRST202", "42883"].includes(error.code ?? ""))
    throw new AdminError(
      "Admin safety migration is not installed. Ask the owner to finish database setup.",
      503,
    );
  throw new AdminError(
    error.message || "The operation failed.",
    error.code === "42501"
      ? 403
      : ["40001", "P0002"].includes(error.code ?? "")
        ? 409
        : 400,
  );
}

export async function adminBody(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Invalid body");
    return body as Record<string, unknown>;
  } catch {
    throw new AdminError("Invalid request. Refresh and try again.");
  }
}

export function requireUuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new AdminError("Invalid record ID.");
  return value;
}

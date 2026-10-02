import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase-admin";
import {
  adminAccess,
  adminBody,
  adminFailure,
  adminJson,
  AdminError,
  requireUuid,
  rpcFailure,
} from "@/lib/admin-access";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!url || !anonKey)
      throw new Error("Supabase environment is not configured.");
    const authorization = request.headers.get("authorization") ?? "";
    const supabase = createClient(url, anonKey, {
      global: authorization
        ? { headers: { Authorization: authorization } }
        : undefined,
    });
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
      .from("partner_verification_documents")
      .select(
        "id,partner_id,applicant_id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,reviewed_at,created_at,storage_path",
      )
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error: listError } = await query;
    if (listError)
      return NextResponse.json({ error: listError.message }, { status: 400 });

    const documents = [];
    for (const item of data ?? []) {
      const { data: signed } = await serviceClient.storage
        .from("partner-documents")
        .createSignedUrl(item.storage_path, 900);

      const { storage_path: _storagePath, ...metadata } = item;
      documents.push({
        ...metadata,
        signed_url: signed?.signedUrl ?? null,
        expires_in_seconds: 900,
      });
    }

    return NextResponse.json({ documents });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load documents.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, client } = await adminAccess(request);
    const body = await adminBody(request),
      id = requireUuid(body.id);
    if (!["approved", "rejected"].includes(String(body.status)))
      throw new AdminError("Choose a valid document review status.");
    const result = await client.rpc("admin_review_document", {
      p_actor: user.id,
      p_id: id,
      p_status: body.status,
      p_expected: body.expected_status,
      p_reason:
        typeof body.rejection_reason === "string"
          ? body.rejection_reason.trim()
          : "",
    });
    if (result.error) rpcFailure(result.error);
    return adminJson({ document: result.data });
  } catch (error) {
    return adminFailure(error);
  }
}

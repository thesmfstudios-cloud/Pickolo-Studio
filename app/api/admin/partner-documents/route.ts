import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from "@/lib/supabase-config";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase-admin";
import { reviewPartner, reviewResponse } from "@/lib/admin-review";

export const runtime = "nodejs";

const url = SUPABASE_URL;
const anonKey = SUPABASE_PUBLIC_KEY;

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

    return reviewResponse({ documents });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load documents.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return reviewPartner(request, "document");
}

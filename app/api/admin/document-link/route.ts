import { NextRequest } from "next/server";
import {
  adminAccess,
  adminFailure,
  adminJson,
  AdminError,
  requireUuid,
} from "@/lib/admin-access";
export async function GET(request: NextRequest) {
  try {
    const { client } = await adminAccess(request);
    const id = requireUuid(request.nextUrl.searchParams.get("id"));
    const doc = await client
      .from("partner_verification_documents")
      .select("storage_path")
      .eq("id", id)
      .single();
    if (doc.error || !doc.data)
      throw new AdminError("Document unavailable.", 404);
    const signed = await client.storage
      .from("partner-documents")
      .createSignedUrl(doc.data.storage_path, 300);
    if (signed.error || !signed.data?.signedUrl)
      throw new AdminError(
        "File has not uploaded or is unavailable. Ask the partner to upload again.",
        409,
      );
    return adminJson({ url: signed.data.signedUrl, expiresInSeconds: 300 });
  } catch (error) {
    return adminFailure(error);
  }
}

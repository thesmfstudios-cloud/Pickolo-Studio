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
    const { client } = await adminAccess(request),
      id = requireUuid(request.nextUrl.searchParams.get("id"));
    const asset = await client
      .from("delivery_assets")
      .select("storage_path")
      .eq("id", id)
      .single();
    if (asset.error || !asset.data)
      throw new AdminError("Backup asset is unavailable.", 404);
    const result = await client.storage
      .from("booking-deliveries")
      .createSignedUrl(asset.data.storage_path, 300);
    if (result.error || !result.data?.signedUrl)
      throw new AdminError("Unable to open this private backup file.", 503);
    return adminJson({ url: result.data.signedUrl, expiresInSeconds: 300 });
  } catch (error) {
    return adminFailure(error);
  }
}

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
    const partnerId = request.nextUrl.searchParams.get("partner_id");
    const id = requireUuid(
      partnerId || request.nextUrl.searchParams.get("application_id"),
    );
    const application = await client
      .from("partner_applications")
      .select(
        "id,applicant_id,display_name,phone,bio,skills,base_lat,base_long,payout_upi_id,status,created_at,rejection_reason",
      )
      .eq(partnerId ? "applicant_id" : "id", id)
      .single();
    if (application.error || !application.data)
      throw new AdminError("Application unavailable. Refresh the queue.", 404);
    const docs = await client
      .from("partner_verification_documents")
      .select(
        "id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,created_at",
      )
      .or(
        `applicant_id.eq.${application.data.applicant_id},partner_id.eq.${application.data.applicant_id}`,
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (docs.error)
      throw new AdminError("Unable to load verification documents.", 503);
    const [partners, services, levels, selected] = await Promise.all([
      client
        .from("partners")
        .select("id,service_level_id,verification_status")
        .eq("id", application.data.applicant_id)
        .limit(1),
      client.from("services").select("id,name").order("name").limit(10),
      client
        .from("service_levels")
        .select("id,name")
        .order("sort_order")
        .limit(10),
      client
        .from("partner_services")
        .select("service_id")
        .eq("partner_id", application.data.applicant_id)
        .limit(10),
    ]);
    if ([partners, services, levels, selected].some((r) => r.error))
      throw new AdminError("Unable to load job eligibility.", 503);
    return adminJson({
      application: application.data,
      documents: docs.data ?? [],
      eligibility: {
        partner: partners.data?.[0] || null,
        services: services.data,
        levels: levels.data,
        selected: selected.data?.map((r) => r.service_id) || [],
      },
    });
  } catch (error) {
    return adminFailure(error);
  }
}

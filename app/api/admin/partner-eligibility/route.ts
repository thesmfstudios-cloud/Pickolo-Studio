import {
  adminAccess,
  adminBody,
  adminFailure,
  adminJson,
  AdminError,
  requireUuid,
  rpcFailure,
} from "@/lib/admin-access";
export async function POST(request: Request) {
  try {
    const { user, client } = await adminAccess(request),
      body = await adminBody(request);
    if (
      !Array.isArray(body.service_ids) ||
      !Array.isArray(body.expected_service_ids) ||
      body.service_ids.length > 10 ||
      body.expected_service_ids.length > 10
    )
      throw new AdminError("Select valid job services.");
    const result = await client.rpc("admin_update_partner_eligibility", {
      p_actor: user.id,
      p_partner: requireUuid(body.partner_id),
      p_level: requireUuid(body.service_level_id),
      p_services: body.service_ids.map(requireUuid),
      p_expected_level:
        body.expected_level_id === null
          ? null
          : requireUuid(body.expected_level_id),
      p_expected_services: body.expected_service_ids.map(requireUuid),
    });
    if (result.error) rpcFailure(result.error);
    return adminJson({
      partner: result.data,
      message:
        "Job eligibility updated. Creator preferences and XP were not changed.",
    });
  } catch (error) {
    return adminFailure(error);
  }
}

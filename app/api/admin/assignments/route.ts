import {
  adminAccess,
  adminBody,
  adminFailure,
  adminJson,
  requireUuid,
  rpcFailure,
} from "@/lib/admin-access";
export async function POST(request: Request) {
  try {
    const { user, client } = await adminAccess(request),
      body = await adminBody(request);
    const booking = requireUuid(body.booking_id),
      partner = requireUuid(body.partner_id);
    const result = await client.rpc("admin_assign_partner", {
      p_actor: user.id,
      p_booking: booking,
      p_partner: partner,
      p_emergency: false,
      p_reason: "Manual admin assignment",
    });
    if (result.error) rpcFailure(result.error);
    return adminJson({ booking: result.data });
  } catch (error) {
    return adminFailure(error);
  }
}

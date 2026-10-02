import {
  adminAccess,
  adminBody,
  adminFailure,
  adminJson,
  requireUuid,
  rpcFailure,
} from "@/lib/admin-access";
import { assignBestPartner } from "@/lib/assignment";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user, client } = await adminAccess(request),
      body = await adminBody(request),
      id = requireUuid((await context.params).id);
    // Older callers can omit the expected state. New UI supplies it.
    let expected = body.expected_status;
    if (typeof expected !== "string") {
      const current = await client
        .from("bookings")
        .select("status")
        .eq("id", id)
        .single();
      if (current.error || !current.data)
        rpcFailure({ code: "P0002", message: "Booking not found." });
      expected = current.data!.status;
    }
    const result = await client.rpc("admin_record_no_show", {
      p_actor: user.id,
      p_booking: id,
      p_expected: expected,
      p_reason: String(body.reason || "Partner no-show.").slice(0, 500),
    });
    if (result.error) rpcFailure(result.error);
    // Recovery is best-effort AFTER the incident transaction; never report that
    // a failed matcher rolled back an already recorded no-show.
    let reassignment;
    try {
      reassignment = await assignBestPartner(id, user.id);
    } catch {
      reassignment = {
        assigned: false,
        reason:
          "Automatic matching is unavailable. Assign a backup partner manually.",
      };
    }
    return adminJson({
      booking: result.data,
      reassignment,
      message: reassignment.assigned
        ? "No-show recorded; a replacement offer was created."
        : "No-show recorded. " + reassignment.reason,
    });
  } catch (error) {
    return adminFailure(error);
  }
}

import {
  adminAccess,
  adminFailure,
  adminJson,
  AdminError,
  requireUuid,
  rpcFailure,
} from "@/lib/admin-access";
import {
  createRazorpayXUpiPayout,
  fetchRazorpayXPayout,
  razorpayXPayoutsEnabled,
} from "@/lib/razorpayx";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user, client } = await adminAccess(request);
    const id = requireUuid((await context.params).id);
    if (!razorpayXPayoutsEnabled())
      throw new AdminError(
        "Real payout provider is not configured. No money moved and no payout was marked paid.",
        503,
      );
    const reserved = await client.rpc("admin_reserve_payout", {
      p_actor: user.id,
      p_booking: id,
    });
    if (reserved.error) rpcFailure(reserved.error);
    const intent = reserved.data;
    let payout;
    try {
      payout = intent.provider_payout_id
        ? await fetchRazorpayXPayout(intent.provider_payout_id)
        : await createRazorpayXUpiPayout({
            amountPaise: Number(intent.amount_paise),
            bookingId: id,
            bookingCode: intent.booking_code,
            partnerId: intent.partner_id,
            partnerName: "Pickolo Partner",
            payoutUpiId: intent.destination_upi_id,
          });
    } catch {
      throw new AdminError(
        "Provider response is unavailable. The request may have reached the provider. Refresh and reconcile this same booking; do not send a separate payment.",
        502,
      );
    }
    if (
      payout.amount !== Number(intent.amount_paise) ||
      payout.currency !== "INR" ||
      payout.referenceId !== ("pickolo_" + intent.booking_code).slice(0, 40)
    )
      throw new AdminError(
        "Provider response does not match this payout. Owner reconciliation required.",
        409,
      );
    const recorded = await client.rpc("admin_record_payout", {
      p_actor: user.id,
      p_booking: id,
      p_provider: payout.id,
      p_status: payout.status,
      p_amount: payout.amount,
    });
    if (recorded.error) rpcFailure(recorded.error);
    return adminJson(
      {
        ...recorded.data,
        message: recorded.data.paid
          ? "Provider confirmed the payout was processed."
          : "Payout " +
            payout.status +
            ". The booking is not marked paid. Reconcile the provider status before completion.",
      },
      recorded.data.paid ? 200 : 202,
    );
  } catch (error) {
    return adminFailure(error);
  }
}

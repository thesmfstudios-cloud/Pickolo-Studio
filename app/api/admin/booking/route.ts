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
    const result = await client
      .from("bookings")
      .select(
        "id,booking_code,status,customer_id,assigned_partner_id,scheduled_start,duration_minutes,location_text,customer_price_paise,partner_payout_paise,partner_acceptance_status,partner_offer_expires_at,service:services(name),service_level:service_levels(name)",
      )
      .eq("id", id)
      .single();
    if (result.error || !result.data)
      throw new AdminError("Booking is unavailable. Refresh the queue.", 404);
    const booking = result.data;
    const [customer, partner, history, assets, disputes, payouts, delivery] =
      await Promise.all([
        client
          .from("profiles")
          .select("full_name,phone")
          .eq("id", booking.customer_id)
          .single(),
        booking.assigned_partner_id
          ? client
              .from("profiles")
              .select("full_name,phone")
              .eq("id", booking.assigned_partner_id)
              .single()
          : Promise.resolve({ data: null, error: null }),
        client
          .from("booking_status_history")
          .select("id,from_status,to_status,created_at,changed_by")
          .eq("booking_id", id)
          .order("created_at", { ascending: false })
          .order("id")
          .limit(100),
        client
          .from("delivery_assets")
          .select("id,file_name,mime_type,size_bytes,created_at")
          .eq("booking_id", id)
          .order("created_at", { ascending: false })
          .order("id")
          .limit(100),
        client
          .from("booking_disputes")
          .select("id,reason_code,status,description,resolution,created_at")
          .eq("booking_id", id)
          .order("created_at", { ascending: false })
          .order("id")
          .limit(100),
        client
          .from("payouts")
          .select("id,status,amount_paise,provider_payout_id,released_at")
          .eq("booking_id", id)
          .limit(1),
        client
          .from("delivery_records")
          .select("submitted_at,customer_confirmed_at")
          .eq("booking_id", id)
          .limit(1),
      ]);
    if (
      [customer, partner, history, assets, disputes, payouts, delivery].some(
        (r) => r.error,
      )
    )
      throw new AdminError(
        "Some booking details could not be loaded. Retry shortly.",
        503,
      );
    return adminJson({
      booking,
      customer: customer.data,
      partner: partner.data,
      history: history.data,
      assets: assets.data,
      disputes: disputes.data,
      payouts: payouts.data,
      delivery: delivery.data,
      limit: 100,
    });
  } catch (error) {
    return adminFailure(error);
  }
}

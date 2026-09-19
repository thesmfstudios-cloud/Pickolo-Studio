import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-admin';
import { assignBestPartner } from '@/lib/assignment';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || authorization !== 'Bearer ' + secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();

    const { data: expired } = await supabase
      .from('bookings')
      .select('id,booking_code,status,assigned_partner_id,partner_offer_expires_at')
      .eq('status', 'PARTNER_ASSIGNED')
      .eq('partner_acceptance_status', 'pending')
      .not('partner_offer_expires_at', 'is', null)
      .lte('partner_offer_expires_at', new Date().toISOString())
      .limit(50);

    const results = [];

    for (const booking of expired ?? []) {
      const oldPartner = booking.assigned_partner_id;
      if (!oldPartner) continue;

      const { data: updated } = await supabase
        .from('bookings')
        .update({
          assigned_partner_id: null,
          status: 'SEARCHING_PARTNER',
          partner_acceptance_status: 'expired',
          partner_offer_expires_at: null,
        })
        .eq('id', booking.id)
        .eq('status', 'PARTNER_ASSIGNED')
        .eq('partner_acceptance_status', 'pending')
        .eq('assigned_partner_id', oldPartner)
        .select('id,booking_code,status,assigned_partner_id,partner_acceptance_status')
        .single();

      if (!updated) continue;

      await supabase.from('partner_assignment_events').insert({
        booking_id: booking.id,
        partner_id: oldPartner,
        event_type: 'EXPIRED',
        reason: 'Partner offer expired without response.',
      });

      await supabase.from('booking_incidents').insert({
        booking_id: booking.id,
        partner_id: oldPartner,
        incident_type: 'PARTNER_OFFER_EXPIRED',
        reason: 'Partner offer expired without response.',
      });

      await supabase.from('booking_status_history').insert({
        booking_id: booking.id,
        from_status: 'PARTNER_ASSIGNED',
        to_status: 'SEARCHING_PARTNER',
        metadata: {
          actor_role: 'system',
          reason: 'partner_offer_expired',
          old_partner_id: oldPartner,
        },
      });

      const reassignment = await assignBestPartner(booking.id);
      results.push({
        bookingId: booking.id,
        oldPartnerId: oldPartner,
        reassignment,
      });
    }

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Offer expiry worker failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

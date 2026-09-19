import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { getApprovedPartner } from '@/lib/partner-auth';
import { assignBestPartner } from '@/lib/assignment';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userClient = getClient(request);
    const serviceClient = getServiceClient();
    const { id } = await context.params;
    const body = await request.json();
    const action = body?.action as 'accept' | 'decline' | undefined;
    const reason = String(body?.reason || '').slice(0, 500);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const partner = await getApprovedPartner(serviceClient, user.id);
    if (!partner) return NextResponse.json({ error: 'Approved partner access required.' }, { status: 403 });

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'action must be accept or decline.' }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await serviceClient
      .from('bookings')
      .select('id,booking_code,status,assigned_partner_id,partner_acceptance_status,partner_offer_expires_at,customer_id')
      .eq('id', id)
      .eq('assigned_partner_id', user.id)
      .single();

    if (bookingError || !booking) return NextResponse.json({ error: 'Assigned booking not found.' }, { status: 404 });

    if (booking.status !== 'PARTNER_ASSIGNED' || booking.partner_acceptance_status !== 'pending') {
      return NextResponse.json({ error: 'This assignment is no longer awaiting your response.' }, { status: 409 });
    }

    if (booking.partner_offer_expires_at && new Date(booking.partner_offer_expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This assignment offer has expired.' }, { status: 409 });
    }

    if (action === 'accept') {
      const { data: updated, error } = await serviceClient
        .from('bookings')
        .update({
          partner_acceptance_status: 'accepted',
          partner_acceptance_at: new Date().toISOString(),
          partner_offer_expires_at: null,
        })
        .eq('id', id)
        .eq('status', 'PARTNER_ASSIGNED')
        .eq('partner_acceptance_status', 'pending')
        .eq('assigned_partner_id', user.id)
        .select('id,booking_code,status,partner_acceptance_status,partner_acceptance_at')
        .single();

      if (error || !updated) return NextResponse.json({ error: 'Assignment changed concurrently. Refresh and retry.' }, { status: 409 });

      await serviceClient.from('partner_assignment_events').insert({
        booking_id: id,
        partner_id: user.id,
        event_type: 'ACCEPTED',
      });

      await serviceClient.from('notifications').insert({
        user_id: booking.customer_id,
        booking_id: id,
        channel: 'in_app',
        title: 'Photographer accepted',
        body: 'Your Pickolo photographer accepted booking ' + booking.booking_code + '.',
      });

      return NextResponse.json({ booking: updated });
    }

    const { data: updated, error } = await serviceClient
      .from('bookings')
      .update({
        assigned_partner_id: null,
        status: 'SEARCHING_PARTNER',
        partner_acceptance_status: 'declined',
        partner_declined_at: new Date().toISOString(),
        partner_offer_expires_at: null,
      })
      .eq('id', id)
      .eq('status', 'PARTNER_ASSIGNED')
      .eq('partner_acceptance_status', 'pending')
      .eq('assigned_partner_id', user.id)
      .select('id,booking_code,status,assigned_partner_id,partner_acceptance_status,partner_declined_at')
      .single();

    if (error || !updated) return NextResponse.json({ error: 'Assignment changed concurrently. Refresh and retry.' }, { status: 409 });

    await serviceClient.from('partner_assignment_events').insert({
      booking_id: id,
      partner_id: user.id,
      event_type: 'DECLINED',
      reason: reason || 'Partner declined the assignment.',
    });

    await serviceClient.from('booking_incidents').insert({
      booking_id: id,
      partner_id: user.id,
      incident_type: 'PARTNER_DECLINE',
      reason: reason || 'Partner declined the assignment.',
      recorded_by: user.id,
    });

    const nextAssignment = await assignBestPartner(id);
    return NextResponse.json({ booking: updated, reassignment: nextAssignment });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { distanceKm, PICKOLO_PILOT_RADIUS_KM } from '@/lib/geo';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getClient(request);
    const serviceClient = getServiceClient();
    const body = await request.json();
    const bookingId = String(body?.booking_id || '');
    const partnerId = String(body?.partner_id || '');
    const reason = String(body?.reason || 'Emergency reassignment.').slice(0, 500);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: admin } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (admin?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    if (!bookingId || !partnerId) {
      return NextResponse.json({ error: 'booking_id and partner_id are required.' }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,status,scheduled_start,duration_minutes,service_level_id,assigned_partner_id')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    if (booking.status !== 'SEARCHING_PARTNER') {
      return NextResponse.json({ error: 'Booking must be in partner search state.' }, { status: 409 });
    }

    const { data: partner } = await supabase
      .from('partners')
      .select('id,verification_status,service_level_id,base_lat,base_long,service_level:service_levels(sort_order)')
      .eq('id', partnerId)
      .single();

    if (!partner || partner.verification_status !== 'approved') {
      return NextResponse.json({ error: 'Partner is not approved.' }, { status: 400 });
    }

    const { data: requestedLevel } = await supabase
      .from('service_levels')
      .select('sort_order')
      .eq('id', booking.service_level_id)
      .single();

    const partnerLevel = Array.isArray(partner.service_level) ? partner.service_level[0] : partner.service_level;

    if (!requestedLevel || !partnerLevel || partnerLevel.sort_order < requestedLevel.sort_order) {
      return NextResponse.json({ error: 'Partner service level is not eligible.' }, { status: 400 });
    }

    const startsAt = new Date(booking.scheduled_start);
    const endsAt = new Date(startsAt.getTime() + Number(booking.duration_minutes) * 60000);

    const { data: activeBookings } = await supabase
      .from('bookings')
      .select('id,scheduled_start,duration_minutes,status')
      .eq('assigned_partner_id', partnerId)
      .not('status', 'in', '("CANCELLED","REFUNDED","COMPLETED","DISPUTED")')
      .neq('id', bookingId);

    const hasConflict = (activeBookings ?? []).some((existing) => {
      const existingStart = new Date(existing.scheduled_start).getTime();
      const existingEnd = existingStart + Number(existing.duration_minutes) * 60000;
      const newStart = startsAt.getTime();
      const newEnd = endsAt.getTime();
      return newStart < existingEnd && newEnd > existingStart;
    });

    if (hasConflict) {
      return NextResponse.json({ error: 'Partner already has an overlapping booking.' }, { status: 409 });
    }

    const { data: availability } = await supabase
      .from('partner_availability')
      .select('id')
      .eq('partner_id', partnerId)
      .eq('available', true)
      .lt('starts_at', endsAt.toISOString())
      .gt('ends_at', startsAt.toISOString())
      .limit(1);

    if (
      booking.location_lat === null ||
      booking.location_long === null ||
      partner.base_lat === null ||
      partner.base_long === null
    ) {
      return NextResponse.json(
        { error: 'Customer and partner locations are required for 5 KM pilot assignment.' },
        { status: 400 },
      );
    }

    const distance = distanceKm(
      Number(booking.location_lat),
      Number(booking.location_long),
      Number(partner.base_lat),
      Number(partner.base_long),
    );

    if (distance > PICKOLO_PILOT_RADIUS_KM) {
      return NextResponse.json(
        { error: 'Partner is outside the Pickolo 5 KM pilot radius.', distanceKm: Number(distance.toFixed(2)) },
        { status: 400 },
      );
    }

    if (!availability?.length) {
      return NextResponse.json({ error: 'Partner has no matching availability.' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('bookings')
      .update({
        assigned_partner_id: partnerId,
        status: 'PARTNER_ASSIGNED',
        partner_acceptance_status: 'pending',
        partner_acceptance_at: null,
        partner_declined_at: null,
      })
      .eq('id', bookingId)
      .eq('status', 'SEARCHING_PARTNER')
      .select('id,booking_code,status,assigned_partner_id')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Reassignment failed because booking changed concurrently.' }, { status: 409 });
    }

    const { error: historyError } = await serviceClient
      .from('booking_status_history')
      .insert({
        booking_id: bookingId,
        from_status: 'SEARCHING_PARTNER',
        to_status: 'PARTNER_ASSIGNED',
        changed_by: user.id,
        metadata: { actor_role: 'admin', assigned_partner_id: partnerId, reason },
      });

    if (historyError) {
      return NextResponse.json({ error: 'Reassignment succeeded but audit logging failed.' }, { status: 500 });
    }

    const { error: reassignmentError } = await supabase
      .from('booking_reassignments')
      .insert({
        booking_id: bookingId,
        from_partner_id: booking.assigned_partner_id,
        to_partner_id: partnerId,
        reason,
        created_by: user.id,
      });

    if (reassignmentError) {
      return NextResponse.json({ error: 'Reassignment succeeded but reassignment audit failed.' }, { status: 500 });
    }

    return NextResponse.json({ booking: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

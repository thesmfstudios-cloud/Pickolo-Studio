import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
    const authorization = request.headers.get('authorization') ?? '';
    const supabase = createClient(url, anonKey, {
      global: authorization ? { headers: { Authorization: authorization } } : undefined,
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || 'Partner cancelled assignment.').slice(0, 500);

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id,status,assigned_partner_id')
      .eq('id', id)
      .single();

    if (error || !booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

    if (booking.assigned_partner_id !== user.id) {
      return NextResponse.json({ error: 'Assigned partner access required.' }, { status: 403 });
    }

    const allowed = new Set(['PARTNER_ASSIGNED', 'ON_THE_WAY']);
    if (!allowed.has(booking.status)) {
      return NextResponse.json({ error: 'Partner cancellation is not allowed at this stage.' }, { status: 409 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'SEARCHING_PARTNER',
        cancellation_reason: reason,
        assigned_partner_id: null,
      })
      .eq('id', id)
      .eq('status', booking.status)
      .eq('assigned_partner_id', user.id)
      .select('id,booking_code,status,cancellation_reason,assigned_partner_id')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Booking changed concurrently. Refresh and retry.' }, { status: 409 });
    }

    await supabase.from('booking_incidents').insert({
      booking_id: id,
      partner_id: user.id,
      incident_type: 'PARTNER_CANCELLATION',
      reason,
      recorded_by: user.id,
    });

    await supabase.from('booking_status_history').insert({
      booking_id: id,
      from_status: booking.status,
      to_status: 'SEARCHING_PARTNER',
      changed_by: user.id,
      metadata: { actor_role: 'partner', reason },
    });

    return NextResponse.json({ booking: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

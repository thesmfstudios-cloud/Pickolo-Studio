import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { assignBestPartner } from '@/lib/assignment';

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
    const supabase = getClient(request);
    const serviceClient = getServiceClient();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || 'Partner no-show.').slice(0, 500);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: admin } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (admin?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id,status,assigned_partner_id')
      .eq('id', id)
      .single();

    if (error || !booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

    if (!['PARTNER_ASSIGNED', 'ON_THE_WAY'].includes(booking.status) || !booking.assigned_partner_id) {
      return NextResponse.json({ error: 'Booking is not eligible for a no-show action.' }, { status: 409 });
    }

    const oldPartner = booking.assigned_partner_id;

    const { data: updated, error: updateError } = await serviceClient
      .from('bookings')
      .update({
        assigned_partner_id: null,
        status: 'SEARCHING_PARTNER',
        cancellation_reason: reason,
      })
      .eq('id', id)
      .eq('status', booking.status)
      .eq('assigned_partner_id', oldPartner)
      .select('id,booking_code,status,assigned_partner_id')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Booking changed concurrently. Refresh and retry.' }, { status: 409 });
    }

    const incident = await serviceClient.from('booking_incidents').insert({
      booking_id: id,
      partner_id: oldPartner,
      incident_type: 'PARTNER_NO_SHOW',
      reason,
      recorded_by: user.id,
    });

    const history = await serviceClient.from('booking_status_history').insert({
      booking_id: id,
      from_status: booking.status,
      to_status: 'SEARCHING_PARTNER',
      changed_by: user.id,
      metadata: { actor_role: 'admin', reason, old_partner_id: oldPartner },
    });

    if (incident.error || history.error) {
      return NextResponse.json(
        { error: 'Booking returned to partner search, but recovery audit logging failed.' },
        { status: 500 },
      );
    }

    const reassignment = await assignBestPartner(id);
    return NextResponse.json({ booking: updated, reassignment });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

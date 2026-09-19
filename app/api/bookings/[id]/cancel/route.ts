import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

const CUSTOMER_CANCELABLE = new Set([
  'REQUESTED',
  'PAYMENT_CONFIRMED',
  'SEARCHING_PARTNER',
  'PARTNER_ASSIGNED',
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = getClient(request);
    const serviceClient = getServiceClient();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || 'Customer requested cancellation.').slice(0, 500);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id,status,customer_id,assigned_partner_id')
      .eq('id', id)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    if (booking.customer_id !== user.id) {
      return NextResponse.json({ error: 'Customer access required.' }, { status: 403 });
    }

    if (!CUSTOMER_CANCELABLE.has(booking.status)) {
      return NextResponse.json({ error: 'This booking can no longer be cancelled.' }, { status: 409 });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('bookings')
      .update({ status: 'CANCELLED', cancellation_reason: reason })
      .eq('id', id)
      .eq('status', booking.status)
      .select('id,booking_code,status,cancellation_reason')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Booking changed concurrently. Refresh and retry.' }, { status: 409 });
    }

    await serviceClient.from('booking_status_history').insert({
      booking_id: id,
      from_status: booking.status,
      to_status: 'CANCELLED',
      changed_by: user.id,
      metadata: { actor_role: 'customer', reason },
    });

    return NextResponse.json({ booking: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

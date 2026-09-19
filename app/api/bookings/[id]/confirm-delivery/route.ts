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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = getClient(request);
    const serviceClient = getServiceClient();
    const { id } = await context.params;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,status,customer_id,assigned_partner_id')
      .eq('id', id)
      .single();

    if (bookingError || !booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    if (booking.customer_id !== user.id) return NextResponse.json({ error: 'Customer access required.' }, { status: 403 });
    if (booking.status !== 'DATA_SUBMITTED') {
      return NextResponse.json({ error: 'Delivery is not ready for confirmation.' }, { status: 409 });
    }

    const now = new Date().toISOString();

    const { data: delivery } = await serviceClient
      .from('delivery_records')
      .select('id')
      .eq('booking_id', id)
      .maybeSingle();

    if (!delivery) {
      return NextResponse.json({ error: 'No delivery record exists for this booking.' }, { status: 409 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'CUSTOMER_CONFIRMED' })
      .eq('id', id)
      .eq('status', 'DATA_SUBMITTED')
      .select('id,booking_code,status')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Booking changed concurrently. Refresh and retry.' }, { status: 409 });
    }

    await serviceClient
      .from('delivery_records')
      .update({ customer_confirmed_at: now })
      .eq('booking_id', id);

    const { error: historyError } = await serviceClient
      .from('booking_status_history')
      .insert({
        booking_id: id,
        from_status: 'DATA_SUBMITTED',
        to_status: 'CUSTOMER_CONFIRMED',
        changed_by: user.id,
        metadata: { actor_role: 'customer' },
      });

    if (historyError) {
      return NextResponse.json({ error: 'Confirmation succeeded but history write failed.' }, { status: 500 });
    }

    return NextResponse.json({ booking: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

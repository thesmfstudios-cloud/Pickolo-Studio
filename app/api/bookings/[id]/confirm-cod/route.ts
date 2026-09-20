import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { assignBestPartner } from '@/lib/assignment';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getUserClient(request: NextRequest) {
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
    const userClient = getUserClient(request);
    const serviceClient = getServiceClient();
    const { id } = await context.params;

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { data: booking, error: bookingError } = await userClient
      .from('bookings')
      .select('id,booking_code,status,customer_id,customer_price_paise')
      .eq('id', id)
      .eq('customer_id', user.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    if (booking.status !== 'REQUESTED') {
      return NextResponse.json({ error: 'This booking is no longer awaiting payment selection.' }, { status: 409 });
    }

    const now = new Date().toISOString();

    const { error: paymentError } = await serviceClient
      .from('payments')
      .upsert({
        booking_id: booking.id,
        provider: 'cod',
        provider_payment_id: null,
        provider_order_id: null,
        provider_signature: null,
        amount_paise: booking.customer_price_paise,
        status: 'pending',
        raw_response: { mode: 'cod_test', note: 'Temporary COD flow for MVP testing.' },
        updated_at: now,
      }, { onConflict: 'booking_id' });

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('bookings')
      .update({ status: 'PAYMENT_CONFIRMED', updated_at: now })
      .eq('id', id)
      .eq('status', 'REQUESTED')
      .select('id,booking_code,status')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Booking changed concurrently. Please refresh.' }, { status: 409 });
    }

    await serviceClient.from('booking_status_history').insert({
      booking_id: id,
      from_status: 'REQUESTED',
      to_status: 'PAYMENT_CONFIRMED',
      changed_by: user.id,
      metadata: {
        actor_role: 'customer',
        payment_method: 'cod',
        payment_state: 'pending',
        test_mode: true,
      },
    });

    const assignment = await assignBestPartner(updated.id);

    return NextResponse.json({
      booking: updated,
      assignment,
      payment: { method: 'cod', status: 'pending' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

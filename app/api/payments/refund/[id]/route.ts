import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!url || !anonKey || !keyId || !keySecret) {
      throw new Error('Payment server configuration is incomplete.');
    }

    const authorization = request.headers.get('authorization') ?? '';
    const userClient = createClient(url, anonKey, {
      global: authorization ? { headers: { Authorization: authorization } } : undefined,
    });
    const serviceClient = getServiceClient();
    const { id } = await context.params;

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: booking, error: bookingError } = await serviceClient
      .from('bookings')
      .select('id,status,customer_id,customer_price_paise')
      .eq('id', id)
      .single();

    if (bookingError || !booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    if (booking.customer_id !== user.id) return NextResponse.json({ error: 'Customer access required.' }, { status: 403 });
    if (booking.status !== 'CANCELLED') return NextResponse.json({ error: 'Only cancelled bookings can enter the refund workflow.' }, { status: 409 });

    const { data: payment } = await serviceClient
      .from('payments')
      .select('id,provider_payment_id,amount_paise,status')
      .eq('booking_id', id)
      .maybeSingle();

    if (!payment || payment.status !== 'captured' || !payment.provider_payment_id) {
      return NextResponse.json({ error: 'No captured payment is available for refund.' }, { status: 409 });
    }

    const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/payments/' + encodeURIComponent(payment.provider_payment_id) + '/refund', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: payment.amount_paise }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json({ error: data?.error?.description || 'Refund failed.' }, { status: 400 });
    }

    await serviceClient
      .from('payments')
      .update({ status: 'refunded' })
      .eq('id', payment.id);

    await serviceClient.from('booking_status_history').insert({
      booking_id: id,
      from_status: 'CANCELLED',
      to_status: 'REFUNDED',
      changed_by: user.id,
      metadata: { actor_role: 'customer', provider: 'razorpay', refund_id: data?.id || null },
    });

    await serviceClient
      .from('bookings')
      .update({ status: 'REFUNDED' })
      .eq('id', id)
      .eq('status', 'CANCELLED');

    return NextResponse.json({ refund: { id: data?.id, status: data?.status }, bookingStatus: 'REFUNDED' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

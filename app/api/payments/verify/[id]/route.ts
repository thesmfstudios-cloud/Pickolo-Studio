import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { fetchRazorpayPayment, verifyPaymentSignature } from '@/lib/razorpay';

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
    const body = await request.json();

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const orderId = String(body?.razorpay_order_id || '');
    const paymentId = String(body?.razorpay_payment_id || '');
    const signature = String(body?.razorpay_signature || '');

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ error: 'Payment verification fields are required.' }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await userClient
      .from('bookings')
      .select('id,booking_code,status,customer_id,customer_price_paise')
      .eq('id', id)
      .eq('customer_id', user.id)
      .single();

    if (bookingError || !booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

    const { data: payment, error: paymentError } = await serviceClient
      .from('payments')
      .select('id,provider_order_id,amount_paise,status')
      .eq('booking_id', id)
      .eq('provider_order_id', orderId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment order is not recognized.' }, { status: 409 });
    }

    if (!verifyPaymentSignature(orderId, paymentId, signature)) {
      return NextResponse.json({ error: 'Payment signature verification failed.' }, { status: 400 });
    }

    const providerPayment = await fetchRazorpayPayment(paymentId);

    if (
      providerPayment.order_id !== orderId ||
      providerPayment.amount !== payment.amount_paise ||
      providerPayment.currency !== 'INR'
    ) {
      return NextResponse.json({ error: 'Verified payment does not match the booking amount/order.' }, { status: 400 });
    }

    if (providerPayment.status !== 'captured') {
      return NextResponse.json({ error: 'Payment is not captured yet.' }, { status: 409 });
    }

    await serviceClient
      .from('payments')
      .update({
        provider_payment_id: paymentId,
        provider_signature: signature,
        status: 'captured',
        captured_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (booking.status === 'PAYMENT_CONFIRMED') {
      return NextResponse.json({ status: 'PAYMENT_CONFIRMED' });
    }

    if (booking.status !== 'REQUESTED') {
      return NextResponse.json({ error: 'Booking is no longer awaiting payment.' }, { status: 409 });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('bookings')
      .update({ status: 'PAYMENT_CONFIRMED' })
      .eq('id', id)
      .eq('status', 'REQUESTED')
      .select('id,booking_code,status')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Booking changed concurrently. Refresh and retry.' }, { status: 409 });
    }

    await serviceClient.from('booking_status_history').insert({
      booking_id: id,
      from_status: 'REQUESTED',
      to_status: 'PAYMENT_CONFIRMED',
      changed_by: user.id,
      metadata: { actor_role: 'customer', provider: 'razorpay', provider_payment_id: paymentId },
    });

    return NextResponse.json({ booking: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

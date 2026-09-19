import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { createRazorpayOrder, publicRazorpayKey } from '@/lib/razorpay';

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
      .select('id,booking_code,status,customer_id,customer_price_paise,payments:payments(id,status,provider_order_id,amount_paise)')
      .eq('id', id)
      .eq('customer_id', user.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    if (booking.status !== 'REQUESTED') {
      return NextResponse.json({ error: 'This booking is not awaiting payment.' }, { status: 409 });
    }

    const existingPayment = Array.isArray(booking.payments) ? booking.payments[0] : booking.payments;
    if (existingPayment?.provider_order_id && ['created', 'pending'].includes(existingPayment.status)) {
      return NextResponse.json({
        keyId: publicRazorpayKey(),
        orderId: existingPayment.provider_order_id,
        amountPaise: existingPayment.amount_paise,
        currency: 'INR',
      });
    }

    if (!booking.customer_price_paise || booking.customer_price_paise < 100) {
      return NextResponse.json({ error: 'Booking amount is not ready for payment.' }, { status: 409 });
    }

    const order = await createRazorpayOrder({
      amountPaise: booking.customer_price_paise,
      receipt: booking.booking_code,
      notes: { booking_id: booking.id },
    });

    const { error: paymentError } = await serviceClient
      .from('payments')
      .upsert({
        booking_id: booking.id,
        provider: 'razorpay',
        provider_order_id: order.id,
        amount_paise: booking.customer_price_paise,
        status: 'created',
      }, { onConflict: 'booking_id' });

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }

    return NextResponse.json({
      keyId: publicRazorpayKey(),
      orderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

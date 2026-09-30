import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from '@/lib/supabase-config';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRazorpayOrder, publicRazorpayKey, fetchOrderPayments } from '@/lib/razorpay';
import { getServiceClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const url = SUPABASE_URL;
const anonKey = SUPABASE_PUBLIC_KEY;

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
      .select('id,booking_code,status,payment_timing,customer_id,customer_price_paise,payments:payments(id,status,provider_order_id,amount_paise)')
      .eq('id', id)
      .eq('customer_id', user.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    if (booking.status !== 'REQUESTED' && !(booking.payment_timing === 'after_shoot' && ['SEARCHING_PARTNER','PARTNER_ASSIGNED','ON_THE_WAY','SHOOT_STARTED','SHOOT_COMPLETED','DATA_PENDING','DATA_SUBMITTED','CUSTOMER_CONFIRMED','COMPLETED'].includes(booking.status))) {
      return NextResponse.json({ error: 'This booking is not awaiting payment.' }, { status: 409 });
    }

    const existingPayment = Array.isArray(booking.payments) ? booking.payments[0] : booking.payments;
    if (existingPayment?.status === 'captured') return NextResponse.json({ error: 'Payment already received. Refresh your booking.' }, { status: 409 });
    if (existingPayment?.provider_order_id && ['created', 'pending', 'failed'].includes(existingPayment.status)) {
      const payments = await fetchOrderPayments(existingPayment.provider_order_id);
      const captured = payments.find(p=>p.status==='captured');
      if(captured){
        if(captured.amount!==booking.customer_price_paise||captured.currency!=='INR'||captured.order_id!==existingPayment.provider_order_id)
          return NextResponse.json({error:'Previous payment amount does not match. Please contact support.'},{status:409});
        const {error} = await serviceClient.rpc('record_verified_payment',{p_booking_id:id,p_order_id:captured.order_id,p_payment_id:captured.id,p_amount:captured.amount});
        if(error)return NextResponse.json({error:error.message},{status:409});
        const {assignBestPartner}=await import('@/lib/assignment');
        await assignBestPartner(id).catch(()=>undefined);
        return NextResponse.json({alreadyPaid:true});
      }
      return NextResponse.json({
        keyId: publicRazorpayKey(),
        orderId: existingPayment.provider_order_id,
        amountPaise: booking.customer_price_paise,
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

    const { data: stored, error: paymentError } = await serviceClient.rpc('store_server_payment_order', {
      p_booking_id: booking.id,
      p_order_id: order.id,
    });

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }

    return NextResponse.json({
      keyId: publicRazorpayKey(),
      orderId: stored.provider_order_id,
      amountPaise: stored.amount_paise,
      currency: 'INR',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

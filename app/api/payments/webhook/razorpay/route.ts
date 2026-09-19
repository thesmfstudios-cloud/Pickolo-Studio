import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-admin';
import { fetchRazorpayPayment, verifyWebhookSignature } from '@/lib/razorpay';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature') ?? '';

    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string | null } };
      };
    };

    const paymentId = payload.payload?.payment?.entity?.id;
    const orderId = payload.payload?.payment?.entity?.order_id;

    if (!paymentId || !orderId) {
      return NextResponse.json({ received: true });
    }

    const serviceClient = getServiceClient();
    const { data: payment } = await serviceClient
      .from('payments')
      .select('id,booking_id,provider_order_id,amount_paise,status')
      .eq('provider_order_id', orderId)
      .maybeSingle();

    if (!payment) return NextResponse.json({ received: true });

    if (payload.event === 'payment.failed') {
      await serviceClient
        .from('payments')
        .update({
          provider_payment_id: paymentId,
          status: 'failed',
          failed_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      return NextResponse.json({ received: true });
    }

    if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
      const providerPayment = await fetchRazorpayPayment(paymentId);

      if (
        providerPayment.order_id !== orderId ||
        providerPayment.amount !== payment.amount_paise ||
        providerPayment.currency !== 'INR' ||
        providerPayment.status !== 'captured'
      ) {
        return NextResponse.json({ error: 'Webhook payment verification mismatch.' }, { status: 400 });
      }

      await serviceClient
        .from('payments')
        .update({
          provider_payment_id: paymentId,
          status: 'captured',
          captured_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      const { data: booking } = await serviceClient
        .from('bookings')
        .select('id,status')
        .eq('id', payment.booking_id)
        .single();

      if (booking?.status === 'REQUESTED') {
        const { data: updated } = await serviceClient
          .from('bookings')
          .update({ status: 'PAYMENT_CONFIRMED' })
          .eq('id', booking.id)
          .eq('status', 'REQUESTED')
          .select('id,status')
          .single();

        if (updated) {
          await serviceClient.from('booking_status_history').insert({
            booking_id: booking.id,
            from_status: 'REQUESTED',
            to_status: 'PAYMENT_CONFIRMED',
            metadata: { actor_role: 'system', provider: 'razorpay', provider_payment_id: paymentId, webhook_event: payload.event },
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

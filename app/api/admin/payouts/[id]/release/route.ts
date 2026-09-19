import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { writeAdminAudit } from '@/lib/admin-audit';

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

    const serviceClient = getServiceClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: admin } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (admin?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const { id } = await context.params;
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,status,assigned_partner_id,partner_payout_paise')
      .eq('id', id)
      .single();

    if (bookingError || !booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    if (booking.status !== 'CUSTOMER_CONFIRMED' || !booking.assigned_partner_id) {
      return NextResponse.json({ error: 'Booking is not payout-ready.' }, { status: 409 });
    }

    const { data: activeDispute } = await serviceClient
      .from('booking_disputes')
      .select('id,status')
      .eq('booking_id', id)
      .in('status', ['open', 'under_review'])
      .maybeSingle();

    if (activeDispute) {
      return NextResponse.json({ error: 'Payout is blocked while this booking has an active dispute.' }, { status: 409 });
    }

    const { data: existing } = await supabase
      .from('payouts')
      .select('id,status')
      .eq('booking_id', id)
      .maybeSingle();

    if (!existing) {
      const { error: payoutError } = await supabase.from('payouts').insert({
        booking_id: id,
        partner_id: booking.assigned_partner_id,
        amount_paise: booking.partner_payout_paise,
        status: 'pending',
      });
      if (payoutError) return NextResponse.json({ error: payoutError.message }, { status: 400 });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('bookings')
      .update({ status: 'PAYOUT_RELEASED' })
      .eq('id', id)
      .eq('status', 'CUSTOMER_CONFIRMED')
      .select('id,booking_code,status')
      .single();

    if (updateError || !updated) return NextResponse.json({ error: 'Booking changed concurrently. Refresh and retry.' }, { status: 409 });

    await serviceClient.from('payouts').update({
      status: 'released',
      released_at: new Date().toISOString(),
    }).eq('booking_id', id);

    await serviceClient.from('booking_status_history').insert({
      booking_id: id,
      from_status: 'CUSTOMER_CONFIRMED',
      to_status: 'PAYOUT_RELEASED',
      changed_by: user.id,
      metadata: { actor_role: 'admin' },
    });

    await writeAdminAudit({ actorId: user.id, action: 'RELEASE_PAYOUT', entityType: 'booking', entityId: id, metadata: { partner_id: booking.assigned_partner_id, amount_paise: booking.partner_payout_paise } });
    return NextResponse.json({ booking: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from '@/lib/supabase-config';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { writeAdminAudit } from '@/lib/admin-audit';
import { createRazorpayXUpiPayout, razorpayXPayoutsEnabled } from '@/lib/razorpayx';

const url = SUPABASE_URL;
const anonKey = SUPABASE_PUBLIC_KEY;

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
      .select('id,booking_code,status,assigned_partner_id,partner_payout_paise')
      .eq('id', id)
      .single();

    if (bookingError || !booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    if (!['DATA_SUBMITTED', 'CUSTOMER_CONFIRMED'].includes(booking.status) || !booking.assigned_partner_id) {
      return NextResponse.json({ error: 'Booking is not payout-ready.' }, { status: 409 });
    }
    const { data: paid } = await serviceClient.from('payments').select('status').eq('booking_id', id).eq('status','captured').maybeSingle();
    if (!paid) return NextResponse.json({ error: 'Customer payment must be received before releasing payout.' }, { status: 409 });

    const { data: payoutPartner } = await serviceClient
      .from('partners')
      .select('payout_upi_id,partner_code')
      .eq('id', booking.assigned_partner_id)
      .single();

    if (!payoutPartner?.payout_upi_id) {
      return NextResponse.json({ error: 'Partner UPI ID is missing. Ask the partner to update payout details before release.' }, { status: 409 });
    }

    if (booking.status === 'DATA_SUBMITTED') {
      const [{ data: delivery }, { count: assetCount }] = await Promise.all([
        serviceClient
          .from('delivery_records')
          .select('id,submitted_at')
          .eq('booking_id', id)
          .maybeSingle(),
        serviceClient
          .from('delivery_assets')
          .select('id', { count: 'exact', head: true })
          .eq('booking_id', id),
      ]);

      if (!delivery?.submitted_at || !assetCount) {
        return NextResponse.json({ error: 'Partner payout is blocked until the Studio backup is received.' }, { status: 409 });
      }

      const { data: handoffHistory } = await serviceClient
        .from('booking_status_history')
        .select('metadata')
        .eq('booking_id', id)
        .eq('to_status', 'DATA_SUBMITTED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const metadata = handoffHistory?.metadata as { customer_handoff?: string } | null;
      if (metadata?.customer_handoff !== 'on_site') {
        return NextResponse.json({ error: 'Partner payout is blocked until on-site customer handoff is recorded.' }, { status: 409 });
      }
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

    let providerPayout: { id: string; status: string } | null = null;
    if (razorpayXPayoutsEnabled()) {
      const [{ data: partnerProfile }, { data: authUser }] = await Promise.all([
        serviceClient.from('profiles').select('full_name,phone').eq('id', booking.assigned_partner_id).single(),
        serviceClient.auth.admin.getUserById(booking.assigned_partner_id),
      ]);

      try {
        providerPayout = await createRazorpayXUpiPayout({
          amountPaise: Number(booking.partner_payout_paise),
          bookingId: booking.id,
          bookingCode: booking.booking_code,
          partnerId: booking.assigned_partner_id,
          partnerName: partnerProfile?.full_name || payoutPartner.partner_code || 'Pickolo Partner',
          partnerEmail: authUser.user?.email,
          partnerPhone: partnerProfile?.phone,
          payoutUpiId: payoutPartner.payout_upi_id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'RazorpayX payout request failed.';
        return NextResponse.json({ error: message }, { status: 502 });
      }
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
        provider_payout_id: providerPayout?.id || null,
      });
      if (payoutError) return NextResponse.json({ error: payoutError.message }, { status: 400 });
    }

    const fromStatus = booking.status;
    const { data: updated, error: updateError } = await serviceClient
      .from('bookings')
      .update({ status: 'PAYOUT_RELEASED' })
      .eq('id', id)
      .eq('status', fromStatus)
      .select('id,booking_code,status')
      .single();

    if (updateError || !updated) return NextResponse.json({ error: 'Booking changed concurrently. Refresh and retry.' }, { status: 409 });

    await serviceClient.from('payouts').update({
      status: providerPayout?.status || 'released',
      released_at: new Date().toISOString(),
    }).eq('booking_id', id);

    await serviceClient.from('booking_status_history').insert({
      booking_id: id,
      from_status: fromStatus,
      to_status: 'PAYOUT_RELEASED',
      changed_by: user.id,
      metadata: {
        actor_role: 'admin',
        payout_trigger: fromStatus === 'DATA_SUBMITTED' ? 'studio_backup_received' : 'customer_confirmation',
        payout_method: 'upi',
        payout_upi_id: payoutPartner.payout_upi_id,
        provider: providerPayout ? 'razorpayx' : 'internal_release',
        provider_payout_id: providerPayout?.id || null,
      },
    });

    await writeAdminAudit({ actorId: user.id, action: 'RELEASE_PAYOUT', entityType: 'booking', entityId: id, metadata: { partner_id: booking.assigned_partner_id, amount_paise: booking.partner_payout_paise, trigger: fromStatus === 'DATA_SUBMITTED' ? 'studio_backup_received' : 'customer_confirmation' } });
    await serviceClient.from('notifications').insert({ user_id: booking.assigned_partner_id, booking_id: id, channel: 'in_app', title: 'Payout released', body: 'Payout for booking ' + updated.booking_code + ' has been released after the Studio backup was received.' });
    return NextResponse.json({ booking: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

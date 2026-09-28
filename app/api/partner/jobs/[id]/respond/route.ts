import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';
import { getApprovedPartner } from '@/lib/partner-auth';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
    const authorization = request.headers.get('authorization') ?? '';
    const userClient = createClient(url, anonKey, {
      global: authorization ? { headers: { Authorization: authorization } } : undefined,
    });
    const serviceClient = getServiceClient();
    const { id } = await context.params;
    const body = await request.json();
    const action = body?.action as 'accept' | 'decline' | undefined;

    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const partner = await getApprovedPartner(serviceClient, user.id);
    if (!partner) return NextResponse.json({ error: 'Approved partner access required.' }, { status: 403 });
    if (!action || !['accept','decline'].includes(action)) {
      return NextResponse.json({ error: 'action must be accept or decline.' }, { status: 400 });
    }

    if (action === 'accept') {
      const { data, error: claimError } = await userClient.rpc('claim_partner_job', { p_booking_id: id });
      if (claimError) {
        const message = claimError.message.includes('already been taken')
          ? 'Another partner accepted this job first.'
          : claimError.message;
        return NextResponse.json({ error: message }, { status: 409 });
      }
      return NextResponse.json({ booking: data?.[0] ?? null });
    }

    const { data: offer, error: offerError } = await serviceClient
      .from('partner_job_offers')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('booking_id', id)
      .eq('partner_id', user.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (offerError || !offer) return NextResponse.json({ error: 'Active job offer not found.' }, { status: 404 });

    await serviceClient.from('partner_assignment_events').insert({
      booking_id: id,
      partner_id: user.id,
      event_type: 'DECLINED',
      reason: String(body?.reason || 'Partner declined pool offer.').slice(0, 500),
    });

    return NextResponse.json({ declined: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

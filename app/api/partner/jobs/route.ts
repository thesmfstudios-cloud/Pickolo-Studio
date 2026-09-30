import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from '@/lib/supabase-config';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApprovedPartner } from '@/lib/partner-auth';
import { getServiceClient } from '@/lib/supabase-admin';

const url = SUPABASE_URL;
const anonKey = SUPABASE_PUBLIC_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
    const authorization = request.headers.get('authorization') ?? '';
    const userClient = createClient(url, anonKey, {
      global: authorization ? { headers: { Authorization: authorization } } : undefined,
    });
    const serviceClient = getServiceClient();

    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const partner = await getApprovedPartner(serviceClient, user.id);
    if (!partner) return NextResponse.json({ error: 'Approved partner access required.' }, { status: 403 });

    const now = new Date().toISOString();
    await serviceClient
      .from('partner_job_offers')
      .update({ status: 'expired', responded_at: now })
      .eq('partner_id', user.id)
      .eq('status', 'pending')
      .lte('expires_at', now);

    const [{ data: assigned, error: assignedError }, { data: offers, error: offersError }] = await Promise.all([
      serviceClient
        .from('bookings')
        .select('id,booking_code,status,scheduled_start,duration_minutes,location_text,location_lat,location_long,notes,partner_payout_paise,service:services(name),service_level:service_levels(name)')
        .eq('assigned_partner_id', user.id)
        .not('status', 'in', '("CANCELLED","REFUNDED","COMPLETED")')
        .order('scheduled_start', { ascending: true }),
      serviceClient
        .from('partner_job_offers')
        .select('id,status,expires_at,booking:bookings(id,booking_code,status,scheduled_start,duration_minutes,location_text,location_lat,location_long,notes,partner_payout_paise,service:services(name),service_level:service_levels(name))')
        .eq('partner_id', user.id)
        .eq('status', 'pending')
        .gt('expires_at', now)
        .order('created_at', { ascending: false }),
    ]);

    if (assignedError || offersError) {
      return NextResponse.json({ error: assignedError?.message || offersError?.message }, { status: 400 });
    }

    const openOffers = (offers ?? [])
      .map((offer: any) => {
        const booking = Array.isArray(offer.booking) ? offer.booking[0] : offer.booking;
        if (!booking || booking.status !== 'SEARCHING_PARTNER') return null;
        return { ...booking, offer_status: offer.status, offer_expires_at: offer.expires_at, is_open_offer: true };
      })
      .filter(Boolean);

    const assignedJobs = (assigned ?? []).map((job: any) => ({
      ...job,
      offer_status: 'accepted',
      is_open_offer: false,
    }));

    return NextResponse.json({ offers: openOffers, assigned: assignedJobs, jobs: [...openOffers, ...assignedJobs] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

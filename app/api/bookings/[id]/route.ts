import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';

const url = 'https://ywlayixocyjwodhfcyus.supabase.co';
const anonKey = 'sb_publishable_ieCYy0Mc0Iy_xUYwtriwyw_HQ19FQbX';

function getClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getClient(request);
    const { id } = await context.params;
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('bookings')
      .select(
        'id,booking_code,status,assigned_partner_id,scheduled_start,duration_minutes,location_text,location_lat,location_long,notes,customer_price_paise,platform_fee_paise,partner_payout_paise,partner_acceptance_status,partner_offer_expires_at,partner_arrived_at,shoot_started_at,shoot_completed_at,data_submitted_at,payout_released_at,completed_at,created_at,service:services(id,name),service_level:service_levels(id,name)',
      )
      .eq('id', id)
      .eq('customer_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const serviceClient = getServiceClient();
    const { data: payment } = await serviceClient
      .from('payments')
      .select('id,status,provider_payment_id,amount_paise,captured_at,failed_at')
      .eq('booking_id', id)
      .maybeSingle();

    let assignedPartner = null;
    if (data.assigned_partner_id && data.partner_acceptance_status === 'accepted') {
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('full_name,avatar_url')
        .eq('id', data.assigned_partner_id)
        .maybeSingle();
      const [{ data: partner }, { data: performance }, { data: portfolio }, { data: recentReviews }] = await Promise.all([
        serviceClient
          .from('partners')
          .select('bio,base_lat,base_long,verification_status,service_level:service_levels(name)')
          .eq('id', data.assigned_partner_id)
          .maybeSingle(),
        serviceClient
          .from('partner_performance')
          .select('average_rating,review_count,completed_jobs')
          .eq('partner_id', data.assigned_partner_id)
          .maybeSingle(),
        serviceClient
          .from('partner_portfolio_media')
          .select('id,image_url,caption,sort_order')
          .eq('partner_id', data.assigned_partner_id)
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .limit(6),
        serviceClient
          .from('reviews')
          .select('rating,comment,created_at')
          .eq('partner_id', data.assigned_partner_id)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);
      const partnerLevel = Array.isArray(partner?.service_level)
        ? partner?.service_level[0]
        : partner?.service_level;
      assignedPartner = {
        name: profile?.full_name || 'Your Pickolo professional',
        avatar_url: profile?.avatar_url,
        bio: partner?.bio,
        verified: partner?.verification_status === 'approved',
        level: partnerLevel?.name || null,
        rating: performance?.average_rating ? Number(performance.average_rating) : null,
        review_count: performance?.review_count || 0,
        completed_jobs: performance?.completed_jobs || 0,
        base_lat: partner?.base_lat == null ? null : Number(partner.base_lat),
        base_long: partner?.base_long == null ? null : Number(partner.base_long),
        portfolio: portfolio ?? [],
        recent_reviews: recentReviews ?? [],
      };
    }
    const showCode =
      data.partner_acceptance_status === 'accepted' &&
      ['PARTNER_ASSIGNED', 'ON_THE_WAY'].includes(data.status);
    const { data: startCode } = showCode
      ? await serviceClient
          .from('booking_start_codes')
          .select('code')
          .eq('booking_id', id)
          .maybeSingle()
      : { data: null };
    return NextResponse.json({
      booking: {
        ...data,
        assigned_partner: assignedPartner,
        booking_otp: startCode?.code ?? null,
        payment: payment ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

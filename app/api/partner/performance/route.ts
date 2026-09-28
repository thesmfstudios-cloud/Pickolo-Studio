import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApprovedPartner } from '@/lib/partner-auth';
import { getServiceClient } from '@/lib/supabase-admin';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

    const [{ data: performance }, { data: payouts }, { data: partnerRow }, { data: xpEvents }] = await Promise.all([
      serviceClient.from('partner_performance')
        .select('completed_jobs,on_time_jobs,cancellations,no_shows,delivered_jobs,average_rating,review_count,xp,updated_at')
        .eq('partner_id', user.id).maybeSingle(),
      serviceClient.from('payouts')
        .select('id,booking_id,amount_paise,status,created_at,released_at')
        .eq('partner_id', user.id).order('created_at', { ascending: false }).limit(100),
      serviceClient.from('partners')
        .select('service_level_id,service_level:service_levels(id,name,sort_order)')
        .eq('id', user.id).single(),
      serviceClient.from('partner_xp_events')
        .select('id,xp_delta,reason,created_at')
        .eq('partner_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);

    const level = Array.isArray(partnerRow?.service_level) ? partnerRow?.service_level[0] : partnerRow?.service_level;
    let progression = null;
    if (partnerRow?.service_level_id) {
      const { data: rule } = await serviceClient
        .from('partner_level_rules')
        .select('min_xp,min_average_rating,min_completed_jobs,next_level:service_levels!partner_level_rules_next_level_id_fkey(id,name)')
        .eq('level_id', partnerRow.service_level_id)
        .maybeSingle();
      if (rule) {
        const next = Array.isArray(rule.next_level) ? rule.next_level[0] : rule.next_level;
        progression = {
          next_level: next ?? null,
          min_xp: rule.min_xp,
          min_average_rating: Number(rule.min_average_rating),
          min_completed_jobs: rule.min_completed_jobs,
        };
      }
    }

    return NextResponse.json({
      level: level ?? null,
      progression,
      performance: performance ?? {
        completed_jobs: 0, on_time_jobs: 0, cancellations: 0, no_shows: 0,
        delivered_jobs: 0, average_rating: null, review_count: 0, xp: 0,
      },
      xp_events: xpEvents ?? [],
      payouts: payouts ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

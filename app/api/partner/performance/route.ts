import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
    const authorization = request.headers.get('authorization') ?? '';
    const supabase = createClient(url, anonKey, {
      global: authorization ? { headers: { Authorization: authorization } } : undefined,
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: role } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (role?.role !== 'partner') return NextResponse.json({ error: 'Partner access required.' }, { status: 403 });

    const [{ data: performance }, { data: payouts }] = await Promise.all([
      supabase.from('partner_performance').select('completed_jobs,on_time_jobs,cancellations,no_shows,delivered_jobs,average_rating,xp,updated_at').eq('partner_id', user.id).maybeSingle(),
      supabase.from('payouts').select('id,booking_id,amount_paise,status,created_at,released_at').eq('partner_id', user.id).order('created_at', { ascending: false }).limit(100),
    ]);

    return NextResponse.json({ performance: performance ?? {
      completed_jobs: 0,
      on_time_jobs: 0,
      cancellations: 0,
      no_shows: 0,
      delivered_jobs: 0,
      average_rating: null,
      xp: 0,
    }, payouts: payouts ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

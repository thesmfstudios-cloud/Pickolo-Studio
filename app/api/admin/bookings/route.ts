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

    const { data: admin } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (admin?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const status = request.nextUrl.searchParams.get('status');

    let query = supabase
      .from('bookings')
      .select('id,booking_code,status,scheduled_start,duration_minutes,location_text,customer_price_paise,assigned_partner_id,customer_id,service:services(name),service_level:service_levels(name)')
      .order('scheduled_start', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ bookings: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

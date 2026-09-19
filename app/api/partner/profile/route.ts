import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getClient(request);
    const serviceClient = getServiceClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data, error: profileError } = await supabase
      .from('partners')
      .select('id,partner_code,verification_status,service_level_id,bio,base_lat,base_long')
      .eq('id', user.id)
      .single();

    if (profileError || !data) return NextResponse.json({ error: 'Partner profile not found.' }, { status: 404 });

    return NextResponse.json({ partner: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getClient(request);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: role } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (role?.role !== 'partner') return NextResponse.json({ error: 'Partner access required.' }, { status: 403 });

    const body = await request.json();
    const lat = Number(body?.base_lat);
    const long = Number(body?.base_long);

    if (!Number.isFinite(lat) || !Number.isFinite(long) || lat < -90 || lat > 90 || long < -180 || long > 180) {
      return NextResponse.json({ error: 'Valid base_lat and base_long are required.' }, { status: 400 });
    }

    const { data, error: updateError } = await serviceClient
      .from('partners')
      .update({ base_lat: lat, base_long: long, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id,partner_code,verification_status,service_level_id,base_lat,base_long')
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    return NextResponse.json({ partner: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

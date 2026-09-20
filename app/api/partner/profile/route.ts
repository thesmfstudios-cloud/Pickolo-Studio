import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApprovedPartner } from '@/lib/partner-auth';
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
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data, error: profileError } = await supabase
      .from('partners')
      .select('id,partner_code,verification_status,service_level_id,bio,base_lat,base_long,is_accepting_jobs')
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
    const serviceClient = getServiceClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: role } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (role?.role !== 'partner') return NextResponse.json({ error: 'Partner access required.' }, { status: 403 });

    const partner = await getApprovedPartner(serviceClient, user.id);
    if (!partner) return NextResponse.json({ error: 'Approved partner access required.' }, { status: 403 });

    const body = await request.json();
    const updates: {
      base_lat?: number;
      base_long?: number;
      is_accepting_jobs?: boolean;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    const hasLat = body?.base_lat !== undefined && body?.base_lat !== null;
    const hasLong = body?.base_long !== undefined && body?.base_long !== null;

    if (hasLat || hasLong) {
      const lat = Number(body?.base_lat);
      const long = Number(body?.base_long);

      if (!Number.isFinite(lat) || !Number.isFinite(long) || lat < -90 || lat > 90 || long < -180 || long > 180) {
        return NextResponse.json({ error: 'Valid base_lat and base_long are required.' }, { status: 400 });
      }

      updates.base_lat = lat;
      updates.base_long = long;
    }

    if (body?.is_accepting_jobs !== undefined) {
      if (typeof body.is_accepting_jobs !== 'boolean') {
        return NextResponse.json({ error: 'is_accepting_jobs must be a boolean.' }, { status: 400 });
      }
      updates.is_accepting_jobs = body.is_accepting_jobs;
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'No partner profile changes supplied.' }, { status: 400 });
    }

    const { data, error: updateError } = await serviceClient
      .from('partners')
      .update(updates)
      .eq('id', user.id)
      .select('id,partner_code,verification_status,service_level_id,base_lat,base_long,is_accepting_jobs')
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    return NextResponse.json({ partner: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

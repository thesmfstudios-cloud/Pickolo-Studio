import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getClient(request);
    const body = await request.json();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const displayName = String(body?.display_name || '').trim();
    const phone = String(body?.phone || '').trim();
    const bio = String(body?.bio || '').trim();
    const skills = Array.isArray(body?.skills)
      ? body.skills.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 20)
      : [];

    const lat = body?.base_lat === undefined || body?.base_lat === null ? null : Number(body.base_lat);
    const long = body?.base_long === undefined || body?.base_long === null ? null : Number(body.base_long);

    if (!displayName || !phone) {
      return NextResponse.json({ error: 'display_name and phone are required.' }, { status: 400 });
    }

    if (
      (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) ||
      (long !== null && (!Number.isFinite(long) || long < -180 || long > 180))
    ) {
      return NextResponse.json({ error: 'Invalid location coordinates.' }, { status: 400 });
    }

    const { data, error: insertError } = await supabase
      .from('partner_applications')
      .upsert({
        applicant_id: user.id,
        display_name: displayName,
        phone,
        bio: bio || null,
        skills,
        base_lat: lat,
        base_long: long,
      }, { onConflict: 'applicant_id' })
      .select('id,applicant_id,display_name,phone,bio,skills,base_lat,base_long,status,created_at,updated_at')
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

    return NextResponse.json({ application: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

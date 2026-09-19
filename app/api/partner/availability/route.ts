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

export async function GET(request: NextRequest) {
  try {
    const supabase = getClient(request);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'partner') {
      return NextResponse.json({ error: 'Partner access required.' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('partner_availability')
      .select('id,starts_at,ends_at,available,created_at')
      .eq('partner_id', user.id)
      .order('starts_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ availability: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getClient(request);
    const body = await request.json();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'partner') {
      return NextResponse.json({ error: 'Partner access required.' }, { status: 403 });
    }

    const start = new Date(String(body?.starts_at || ''));
    const end = new Date(String(body?.ends_at || ''));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Valid starts_at and ends_at are required.' }, { status: 400 });
    }

    if (start.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Availability must start in the future.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('partner_availability')
      .insert({
        partner_id: user.id,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        available: body?.available !== false,
      })
      .select('id,starts_at,ends_at,available')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ availability: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

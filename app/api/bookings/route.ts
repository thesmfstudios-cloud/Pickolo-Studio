import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured.');
  }

  const authorization = request.headers.get('authorization') ?? '';

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase(request);
    const body = await request.json();

    const {
      service_id,
      service_level_id,
      scheduled_start,
      duration_minutes,
      location_text,
      location_lat,
      location_long,
      notes,
    } = body ?? {};

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!service_id || !service_level_id || !scheduled_start || !location_text) {
      return NextResponse.json(
        { error: 'service_id, service_level_id, scheduled_start and location_text are required.' },
        { status: 400 },
      );
    }

    const start = new Date(String(scheduled_start));
    if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'scheduled_start must be a valid future timestamp.' },
        { status: 400 },
      );
    }

    if (![30, 60, 120].includes(Number(duration_minutes))) {
      return NextResponse.json(
        { error: 'duration_minutes must be 30, 60 or 120.' },
        { status: 400 },
      );
    }

    const [{ data: service }, { data: level }] = await Promise.all([
      supabase
        .from('services')
        .select('id')
        .eq('id', service_id)
        .eq('active', true)
        .maybeSingle(),
      supabase
        .from('service_levels')
        .select('id')
        .eq('id', service_level_id)
        .eq('active', true)
        .maybeSingle(),
    ]);

    if (!service || !level) {
      return NextResponse.json(
        { error: 'Selected service or service level is not active.' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        customer_id: user.id,
        service_id,
        service_level_id,
        scheduled_start,
        duration_minutes: Number(duration_minutes),
        location_text,
        location_lat: location_lat ?? null,
        location_long: location_long ?? null,
        notes: notes ?? null,
      })
      .select('id, booking_code, status, scheduled_start, duration_minutes, location_text')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ booking: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase(request);

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
        'id, booking_code, status, scheduled_start, duration_minutes, location_text, created_at',
      )
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ bookings: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
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

    if (!service_id || !service_level_id || !scheduled_start || !location_text) {
      return NextResponse.json(
        { error: 'service_id, service_level_id, scheduled_start and location_text are required.' },
        { status: 400 },
      );
    }

    const locationText = String(location_text).trim();
    if (locationText.length < 3 || locationText.length > 300) {
      return NextResponse.json(
        { error: 'location_text must be between 3 and 300 characters.' },
        { status: 400 },
      );
    }

    const latitude = Number(location_lat);
    const longitude = Number(location_long);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return NextResponse.json({ error: 'location_lat must be a valid latitude.' }, { status: 400 });
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: 'location_long must be a valid longitude.' }, { status: 400 });
    }

    const normalizedNotes = notes == null ? null : String(notes).trim();
    if (normalizedNotes && normalizedNotes.length > 2000) {
      return NextResponse.json({ error: 'notes must be 2000 characters or fewer.' }, { status: 400 });
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

    const { data, error } = await supabase.rpc('create_customer_booking', {
      p_service_id: String(service_id),
      p_service_level_id: String(service_level_id),
      p_scheduled_start: String(scheduled_start),
      p_duration_minutes: Number(duration_minutes),
      p_location_text: locationText,
      p_location_lat: latitude,
      p_location_long: longitude,
      p_notes: normalizedNotes,
    });

    if (error) {
      const status = /Authentication required/i.test(error.message) ? 401
        : /Pricing is not configured|not active/i.test(error.message) ? 409
        : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    const booking = Array.isArray(data) ? data[0] : data;
    if (!booking?.id || !booking?.booking_code) {
      return NextResponse.json(
        { error: 'Booking was created but the server returned an invalid response.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase(request);
    const authorization = request.headers.get('authorization') ?? '';

    if (!authorization) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('bookings')
      .select(
        'id, booking_code, status, scheduled_start, duration_minutes, location_text, created_at',
      )
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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase-admin';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function client(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, { global: authorization ? { headers: { Authorization: authorization } } : undefined });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = client(request);
    const serviceClient = getServiceClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const bookingId = String(body?.booking_id || '');
    const reasonCode = String(body?.reason_code || '').trim().slice(0, 80);
    const description = String(body?.description || '').trim().slice(0, 2000);
    if (!bookingId || !reasonCode || !description) return NextResponse.json({ error: 'booking_id, reason_code and description are required.' }, { status: 400 });

    const { data: booking } = await supabase.from('bookings').select('id,status,customer_id').eq('id', bookingId).single();
    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    if (booking.customer_id !== user.id) return NextResponse.json({ error: 'Customer access required.' }, { status: 403 });
    if (!['DATA_SUBMITTED','CUSTOMER_CONFIRMED','PAYOUT_RELEASED','COMPLETED'].includes(booking.status)) return NextResponse.json({ error: 'This booking is not eligible for dispute.' }, { status: 409 });

    const { data: existing } = await serviceClient.from('booking_disputes').select('id,status').eq('booking_id', bookingId).maybeSingle();
    if (existing) return NextResponse.json({ error: 'A dispute already exists for this booking.' }, { status: 409 });

    const { data: dispute, error } = await serviceClient.from('booking_disputes').insert({
      booking_id: bookingId,
      opened_by: user.id,
      reason_code: reasonCode,
      description,
      status: 'open',
    }).select('id,booking_id,reason_code,description,status,created_at').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ dispute }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to open dispute.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = client(request);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data, error } = await supabase.from('booking_disputes').select('id,booking_id,reason_code,description,status,resolution,resolved_at,created_at').eq('opened_by', user.id).order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ disputes: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load disputes.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
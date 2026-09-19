
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApprovedPartner } from '@/lib/partner-auth';
import { getServiceClient } from '@/lib/supabase-admin';
import { BOOKING_TRANSITIONS, type BookingState } from '@/types/pickolo';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getClient(request: NextRequest) {
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
  const authorization = request.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

const PARTNER_ALLOWED: Partial<Record<BookingState, BookingState[]>> = {
  PARTNER_ASSIGNED: ['ON_THE_WAY'],
  ON_THE_WAY: ['SHOOT_STARTED'],
  SHOOT_STARTED: ['SHOOT_COMPLETED'],
  SHOOT_COMPLETED: ['DATA_PENDING'],
  DATA_PENDING: ['DATA_SUBMITTED'],
};

const CUSTOMER_ALLOWED: Partial<Record<BookingState, BookingState[]>> = {
  DATA_SUBMITTED: ['CUSTOMER_CONFIRMED'],
};

const ADMIN_ALLOWED: Partial<Record<BookingState, BookingState[]>> = {
  REQUESTED: ['PAYMENT_CONFIRMED'],
  PAYMENT_CONFIRMED: ['SEARCHING_PARTNER'],
  SEARCHING_PARTNER: ['PARTNER_ASSIGNED'],
  CUSTOMER_CONFIRMED: ['PAYOUT_RELEASED'],
  PAYOUT_RELEASED: ['COMPLETED'],
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = getClient(request);
    const serviceClient = getServiceClient();
    const { id } = await context.params;
    const body = await request.json();
    const toStatus = body?.to_status as BookingState | undefined;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!toStatus || !(toStatus in BOOKING_TRANSITIONS)) {
      return NextResponse.json({ error: 'Invalid target booking status.' }, { status: 400 });
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id,status,customer_id,assigned_partner_id')
      .eq('id', id)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role as 'customer' | 'partner' | 'admin' | undefined;
    const fromStatus = booking.status as BookingState;

    let allowedTargets: BookingState[] = [];

    if (role === 'partner') {
      const partner = await getApprovedPartner(serviceClient, user.id);
      if (!partner) {
        return NextResponse.json({ error: 'Approved partner access required.' }, { status: 403 });
      }
    }

    if (role === 'admin') {
      allowedTargets = ADMIN_ALLOWED[fromStatus] ?? [];
    } else if (role === 'partner' && booking.assigned_partner_id === user.id) {
      allowedTargets = PARTNER_ALLOWED[fromStatus] ?? [];
    } else if (role === 'customer' && booking.customer_id === user.id) {
      allowedTargets = CUSTOMER_ALLOWED[fromStatus] ?? [];
    } else {
      return NextResponse.json({ error: 'You are not authorized for this booking.' }, { status: 403 });
    }

    if (!allowedTargets.includes(toStatus)) {
      return NextResponse.json({ error: 'This role cannot perform the requested transition.' }, { status: 403 });
    }

    if (!BOOKING_TRANSITIONS[fromStatus].includes(toStatus)) {
      return NextResponse.json({ error: 'Invalid booking state transition.' }, { status: 409 });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('bookings')
      .update({ status: toStatus })
      .eq('id', id)
      .eq('status', fromStatus)
      .select('id,booking_code,status,updated_at')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Booking changed concurrently. Refresh and retry.' }, { status: 409 });
    }

    const { error: historyError } = await serviceClient
      .from('booking_status_history')
      .insert({
        booking_id: id,
        from_status: fromStatus,
        to_status: toStatus,
        changed_by: user.id,
        metadata: { actor_role: role },
      });

    if (historyError) {
      return NextResponse.json(
        { error: 'Transition applied but history recording failed.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ booking: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
